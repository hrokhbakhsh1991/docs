const PAYMENT_MODE_LABEL_KEYS: Readonly<Record<string, string>> = {
  offline_receipt: "detail.registerPreview.paymentModes.offlineReceipt",
  gateway: "detail.registerPreview.paymentModes.gateway",
};

export function resolveCatalogPaymentModeLabelKey(mode: string): string | null {
  return PAYMENT_MODE_LABEL_KEYS[mode] ?? null;
}
