import { applyRate, assertCents, type Cents } from "./money.ts";

export type Discount =
  { readonly kind: "percent"; readonly percent: number } | { readonly kind: "fixed"; readonly amount: Cents };

export class DiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountError";
  }
}

/** The discount codes customers can type at checkout. */
export const DISCOUNT_CODES: Readonly<Record<string, Discount>> = {
  SAVE10: { kind: "percent", percent: 10 },
  SAVE25: { kind: "percent", percent: 25 },
  MINUS20: { kind: "fixed", amount: 2000 },
};

/** Codes are matched ignoring letter case and surrounding spaces, so `" save10 "` finds `SAVE10`. */
export function lookupDiscount(code: string): Discount {
  const discount = DISCOUNT_CODES[code.trim().toUpperCase()];
  if (discount === undefined) {
    throw new DiscountError(`Unknown discount code: "${code}"`);
  }
  return discount;
}

/** Returns how many cents a discount takes off a subtotal. Never more than the subtotal. */
export function discountAmount(subtotal: Cents, discount: Discount): Cents {
  assertCents(subtotal);
  const raw = discount.kind === "percent" ? applyRate(subtotal, discount.percent / 100) : discount.amount;
  return Math.min(raw, subtotal);
}
