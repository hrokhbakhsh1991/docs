import type {
  ReceiptProofSignedUrlInput,
  ReceiptProofStoragePort,
} from "../ports/finance-receipt-proof-url.port";
import { getMemberReceiptProofSignedReadUrl } from "../receipt-proof-storage";

/** Host adapter — MinIO / receipt-proof signed read URLs. */
export class HostFinanceReceiptProofUrlAdapter implements ReceiptProofStoragePort {
  getSignedReadUrl(input: ReceiptProofSignedUrlInput): Promise<string> {
    return getMemberReceiptProofSignedReadUrl(input);
  }
}
