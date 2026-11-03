import { discountAmount, lookupDiscount } from "./discounts.ts";
import { applyRate, assertCents, type Cents } from "./money.ts";

export interface InvoiceLine {
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: Cents;
  /** VAT rate as a fraction, e.g. 0.23 for 23%. */
  readonly vatRate: number;
}

export interface InvoiceTotals {
  readonly subtotal: Cents;
  readonly discount: Cents;
  readonly net: Cents;
  readonly vat: Cents;
  readonly total: Cents;
}

export class InvoiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceError";
  }
}

/**
 * Computes invoice totals. The discount is spread over the lines in proportion to their
 * value, and VAT is computed and rounded per line (see GLOSSARY.md: "line VAT").
 */
export function computeInvoice(lines: readonly InvoiceLine[], discountCode?: string): InvoiceTotals {
  if (lines.length === 0) {
    throw new InvoiceError("An invoice needs at least one line");
  }
  lines.forEach(validateLine);

  const lineValues = lines.map((line) => line.unitPrice * line.quantity);
  const subtotal = lineValues.reduce((sum, value) => sum + value, 0);
  const discount = discountCode === undefined ? 0 : discountAmount(subtotal, lookupDiscount(discountCode));

  const lineDiscounts = allocate(discount, lineValues);
  const vat = lines.reduce((sum, line, i) => {
    const lineNet = (lineValues[i] ?? 0) - (lineDiscounts[i] ?? 0);
    return sum + applyRate(lineNet, line.vatRate);
  }, 0);

  const net = subtotal - discount;
  return { subtotal, discount, net, vat, total: net + vat };
}

export interface OriginalInvoice {
  readonly lines: readonly InvoiceLine[];
  readonly discountCode?: string;
}

/**
 * Computes a correction of an original invoice (see docs/adr/0004-correction-as-before-after-difference.md).
 * `afterLines` lists every original line with its quantity after the correction; quantity 0 removes it.
 * Each amount is the after state minus the before state, and each state is computed like an invoice.
 */
export function computeCorrection(original: OriginalInvoice, afterLines: readonly InvoiceLine[]): InvoiceTotals {
  if (original.discountCode !== undefined) {
    throw new InvoiceError("A correction cannot refer to an original invoice with a discount code");
  }
  validateOriginalLines(original.lines);
  const before = computeInvoice(original.lines);
  validateAfterLines(original.lines, afterLines);

  const remaining = afterLines.filter((line) => line.quantity > 0);
  const after: InvoiceTotals =
    remaining.length === 0 ? { subtotal: 0, discount: 0, net: 0, vat: 0, total: 0 } : computeInvoice(remaining);

  return {
    subtotal: after.subtotal - before.subtotal,
    discount: after.discount - before.discount,
    net: after.net - before.net,
    vat: after.vat - before.vat,
    total: after.total - before.total,
  };
}

/** Checks that each SKU appears once on the original invoice, so each after line has one original line to compare with. */
function validateOriginalLines(originalLines: readonly InvoiceLine[]): void {
  const seen = new Set<string>();
  for (const line of originalLines) {
    if (seen.has(line.sku)) {
      throw new InvoiceError(`Line ${line.sku}: listed more than once on the original invoice`);
    }
    seen.add(line.sku);
  }
}

/**
 * Checks that the after state lists each original line once, with only a lower quantity.
 * An empty after state is allowed: it removes every line, so every after amount is 0 (ADR 0004).
 */
function validateAfterLines(originalLines: readonly InvoiceLine[], afterLines: readonly InvoiceLine[]): void {
  const originalBySku = new Map(originalLines.map((line) => [line.sku, line]));
  const seen = new Set<string>();
  for (const line of afterLines) {
    const originalLine = originalBySku.get(line.sku);
    if (originalLine === undefined) {
      throw new InvoiceError(`Line ${line.sku}: not on the original invoice`);
    }
    if (seen.has(line.sku)) {
      throw new InvoiceError(`Line ${line.sku}: listed more than once`);
    }
    seen.add(line.sku);
    validateCorrectedLine(line, originalLine);
  }
  if (afterLines.length === 0) {
    return;
  }
  for (const sku of originalBySku.keys()) {
    if (!seen.has(sku)) {
      throw new InvoiceError(`Line ${sku}: missing from the after state (use quantity 0 to remove it)`);
    }
  }
}

function validateCorrectedLine(line: InvoiceLine, originalLine: InvoiceLine): void {
  if (line.unitPrice !== originalLine.unitPrice || line.vatRate !== originalLine.vatRate) {
    throw new InvoiceError(`Line ${line.sku}: unit price and VAT rate cannot change in a correction`);
  }
  if (!Number.isInteger(line.quantity) || line.quantity < 0 || line.quantity > originalLine.quantity) {
    throw new InvoiceError(
      `Line ${line.sku}: quantity must be an integer from 0 to ${originalLine.quantity}, got ${line.quantity}`,
    );
  }
}

function validateLine(line: InvoiceLine): void {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    throw new InvoiceError(`Line ${line.sku}: quantity must be a positive integer`);
  }
  assertCents(line.unitPrice);
  if (line.unitPrice < 0) {
    throw new InvoiceError(`Line ${line.sku}: unit price cannot be negative`);
  }
  if (line.vatRate < 0 || line.vatRate > 1) {
    throw new InvoiceError(`Line ${line.sku}: VAT rate must be between 0 and 1`);
  }
}

/** Splits `amount` across `weights` proportionally; the rounding remainder goes to the last line. */
function allocate(amount: Cents, weights: readonly Cents[]): Cents[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (amount === 0 || total === 0) {
    return weights.map(() => 0);
  }
  const shares = weights.map((w) => Math.floor((amount * w) / total));
  const remainder = amount - shares.reduce((sum, s) => sum + s, 0);
  shares[shares.length - 1] = (shares[shares.length - 1] ?? 0) + remainder;
  return shares;
}
