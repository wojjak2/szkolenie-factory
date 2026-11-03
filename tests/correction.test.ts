import { describe, expect, it } from "vitest";
import { computeCorrection, computeInvoice, InvoiceError, type InvoiceLine } from "../src/invoice.ts";

const books: InvoiceLine = { sku: "BOOK", quantity: 2, unitPrice: 150, vatRate: 0.23 };
const pens: InvoiceLine = { sku: "PEN", quantity: 3, unitPrice: 100, vatRate: 0.23 };

describe("computeCorrection", () => {
  it("is the after state minus the original, with VAT rounded for each state", () => {
    // Before: subtotal 300, VAT 69, total 369. After: subtotal 150, VAT 35 (34.5 rounds away), total 185.
    expect(computeCorrection({ lines: [books] }, [{ ...books, quantity: 1 }])).toEqual({
      subtotal: -150,
      discount: 0,
      net: -150,
      vat: -34,
      total: -184,
    });
  });

  it("removes a line whose quantity is 0 from the after state", () => {
    const before = computeInvoice([books, pens]);
    const after = computeInvoice([pens]);
    expect(computeCorrection({ lines: [books, pens] }, [{ ...books, quantity: 0 }, pens])).toEqual({
      subtotal: after.subtotal - before.subtotal,
      discount: 0,
      net: after.net - before.net,
      vat: after.vat - before.vat,
      total: after.total - before.total,
    });
  });

  it("makes every after amount 0 when all lines are set to quantity 0", () => {
    const before = computeInvoice([books, pens]);
    expect(
      computeCorrection({ lines: [books, pens] }, [
        { ...books, quantity: 0 },
        { ...pens, quantity: 0 },
      ]),
    ).toEqual({
      subtotal: -before.subtotal,
      discount: 0,
      net: -before.net,
      vat: -before.vat,
      total: -before.total,
    });
  });

  it("is all zeros when no quantity changes", () => {
    expect(computeCorrection({ lines: [books, pens] }, [books, pens])).toEqual({
      subtotal: 0,
      discount: 0,
      net: 0,
      vat: 0,
      total: 0,
    });
  });

  it("rejects a quantity above the original, a negative quantity, or a fractional quantity", () => {
    const original = { lines: [books] };
    expect(() => computeCorrection(original, [{ ...books, quantity: 3 }])).toThrow(InvoiceError);
    expect(() => computeCorrection(original, [{ ...books, quantity: -1 }])).toThrow(InvoiceError);
    expect(() => computeCorrection(original, [{ ...books, quantity: 1.5 }])).toThrow(InvoiceError);
  });

  it("rejects a change to unit price or VAT rate, or a SKU that is not on the original", () => {
    const original = { lines: [books] };
    expect(() => computeCorrection(original, [{ ...books, unitPrice: 200 }])).toThrow(InvoiceError);
    expect(() => computeCorrection(original, [{ ...books, vatRate: 0.05 }])).toThrow(InvoiceError);
    expect(() => computeCorrection(original, [{ ...books, sku: "OTHER" }])).toThrow(InvoiceError);
  });

  it("rejects a SKU listed twice in the after state", () => {
    const original = { lines: [books] };
    expect(() => computeCorrection(original, [books, { ...books, quantity: 1 }])).toThrow(InvoiceError);
  });

  it("rejects an original line that is missing from the after state", () => {
    expect(() => computeCorrection({ lines: [books, pens] }, [books])).toThrow(InvoiceError);
  });

  it("makes every after amount 0 when the after state has no lines (ADR 0004)", () => {
    const before = computeInvoice([books, pens]);
    expect(computeCorrection({ lines: [books, pens] }, [])).toEqual({
      subtotal: -before.subtotal,
      discount: 0,
      net: -before.net,
      vat: -before.vat,
      total: -before.total,
    });
  });

  it("rejects an original invoice that lists a SKU twice", () => {
    const original = { lines: [books, { ...books, quantity: 1 }] };
    expect(() => computeCorrection(original, [books])).toThrow(InvoiceError);
  });

  it("rejects an original invoice that has a discount code", () => {
    expect(() => computeCorrection({ lines: [books], discountCode: "SAVE10" }, [books])).toThrow(InvoiceError);
  });
});
