export interface FinanceStorageDriverPort {
  isDurablePersistence(): boolean;
  isDatabaseConfigured(): boolean;
}

/** Phase 2.2.5 alias — same contract as {@link FinanceStorageDriverPort}. */
export type FinanceStoragePort = FinanceStorageDriverPort;

/** @deprecated Prefer {@link FinanceStorageDriverPort}. */
export type FinancePersistenceModePort = FinanceStorageDriverPort;
