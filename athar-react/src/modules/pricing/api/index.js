import { createPaymentInvoice, redeemPromoCode } from "@shared/api";

export function createInvoice(payload) {
  return createPaymentInvoice(payload);
}

export function redeemCode(code) {
  return redeemPromoCode(code);
}
