import { describe, expect, it } from "vitest";
import { DiscountError, discountAmount, lookupDiscount } from "../src/discounts.ts";

describe("lookupDiscount", () => {
  it("finds a known code", () => {
    expect(lookupDiscount("SAVE10")).toEqual({ kind: "percent", percent: 10 });
  });

  it("rejects an unknown code", () => {
    expect(() => lookupDiscount("FREE")).toThrow(DiscountError);
  });

  it("ignores letter case", () => {
    expect(lookupDiscount("save10")).toEqual({ kind: "percent", percent: 10 });
  });

  it("ignores leading and trailing whitespace", () => {
    expect(lookupDiscount(" Save10 ")).toEqual({ kind: "percent", percent: 10 });
  });
});

describe("discountAmount", () => {
  it("takes a percentage off", () => {
    expect(discountAmount(10000, { kind: "percent", percent: 10 })).toBe(1000);
  });

  it("takes a fixed amount off", () => {
    expect(discountAmount(10000, { kind: "fixed", amount: 2000 })).toBe(2000);
  });

  it("never discounts more than the subtotal", () => {
    expect(discountAmount(1500, { kind: "fixed", amount: 2000 })).toBe(1500);
  });
});
