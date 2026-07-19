export type ReceiptProofSignedUrlInput = {
  readonly tenantId: string;
  readonly storageKey: string;
};

/** @deprecated Prefer {@link ReceiptProofSignedUrlInput}. */
export type FinanceReceiptProofSignedUrlInput = ReceiptProofSignedUrlInput;

export interface ReceiptProofStoragePort {
  getSignedReadUrl(input: ReceiptProofSignedUrlInput): Promise<string>;
}

/** @deprecated Prefer {@link ReceiptProofStoragePort}. */
export type FinanceReceiptProofUrlPort = ReceiptProofStoragePort;
