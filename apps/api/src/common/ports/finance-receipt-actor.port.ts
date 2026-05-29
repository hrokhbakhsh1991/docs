import type { EntityManager } from "typeorm";

export const FINANCE_RECEIPT_ACTOR_PORT = Symbol("FINANCE_RECEIPT_ACTOR_PORT");

export interface FinanceReceiptActorPort {
  getUserPhoneForReceiptUpload(
    _manager: EntityManager,
    _userId: string
  ): Promise<string | null>;
}
