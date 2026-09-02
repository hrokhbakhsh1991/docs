import type { WalletIdempotencyRecord } from "../application/idempotency";

export interface WalletIdempotencyPort {
  lookup(
    tenantId: string,
    creationIdempotencyKey: string,
  ): Promise<WalletIdempotencyRecord | null>;

  save(record: WalletIdempotencyRecord): Promise<void>;
}
