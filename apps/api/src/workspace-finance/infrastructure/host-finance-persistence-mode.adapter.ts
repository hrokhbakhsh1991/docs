import { resolveStorageDriver } from "../../storage/production-storage-driver-assert";
import type { FinanceStorageDriverPort } from "../ports/finance-persistence-mode.port";

/** Host adapter — durable when STORAGE_DRIVER is not memory; DB when DATABASE_URL set. */
export class HostFinancePersistenceModeAdapter implements FinanceStorageDriverPort {
  isDurablePersistence(): boolean {
    return resolveStorageDriver() !== "memory";
  }

  isDatabaseConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL?.trim());
  }
}
