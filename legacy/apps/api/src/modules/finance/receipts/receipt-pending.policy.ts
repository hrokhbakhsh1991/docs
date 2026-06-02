import { ConflictException } from "@nestjs/common";
import { ReceiptStatus } from "../../payments/entities/payment-receipt.entity";

export const RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT = {
  error: {
    code: "RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT",
    message: "A pending receipt already exists for this payment"
  }
} as const;

export function assertNoPendingReceiptForPayment(
  existing: Array<{ status: ReceiptStatus }>
): void {
  if (existing.some((r) => r.status === ReceiptStatus.PENDING)) {
    throw new ConflictException(RECEIPT_PENDING_ALREADY_EXISTS_FOR_PAYMENT);
  }
}
