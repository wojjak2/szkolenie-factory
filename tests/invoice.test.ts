import { describe, expect, it } from "vitest";
import { DiscountError } from "../src/discounts.ts";
import { computeInvoice, InvoiceError, type InvoiceLine } from "../src/invoice.ts";

const book: InvoiceLine = { sku: "BOOK", quantity: 2, unitPrice: 4999, vatRate: 0.05 };
const laptop: InvoiceLine = { sku: "LAPTOP", quantity: 1, unitPrice: 350000, vatRate: 0.23 };

describe("computeInvoice", () => {
  it("adds up lines and per-line VAT", () => {
    expect(computeInvoice([book, laptop])).toEqual({
      subtotal: 359998,
      discount: 0,
      net: 359998,
      vat: 81000, // 500 (5% of 99.98, rounded) + 80500
      total: 440998,
    });
  });

  it("spreads a percentage discount across lines before VAT", () => {
    const totals = computeInvoice([book, laptop], "SAVE10");
    expect(totals.discount).toBe(36000);
    expect(totals.net).toBe(323998);
    expect(totals.total).toBe(totals.net + totals.vat);
  });

  it("matches a discount code regardless of letter case or surrounding spaces", () => {
    const expected = computeInvoice([book, laptop], "SAVE10");
    expect(computeInvoice([book, laptop], "save10")).toEqual(expected);
    expect(computeInvoice([book, laptop], " Save10 ")).toEqual(expected);
  });

  it("still rejects an unknown code even when it is normalised", () => {
    expect(() => computeInvoice([book, laptop], "SAVE99")).toThrow(DiscountError);
  });

  it("caps a fixed discount at the subtotal", () => {
    const cheap: InvoiceLine = { sku: "PEN", quantity: 1, unitPrice: 500, vatRate: 0.23 };
    expect(computeInvoice([cheap], "MINUS20")).toMatchObject({ discount: 500, net: 0, vat: 0, total: 0 });
  });

  it("rejects an empty invoice", () => {
    expect(() => computeInvoice([])).toThrow(InvoiceError);
  });

  it("rejects a zero quantity", () => {
    expect(() => computeInvoice([{ ...book, quantity: 0 }])).toThrow(InvoiceError);
  });

  it("rejects a VAT rate given as a percentage", () => {
    expect(() => computeInvoice([{ ...book, vatRate: 23 }])).toThrow(InvoiceError);
  });
});
