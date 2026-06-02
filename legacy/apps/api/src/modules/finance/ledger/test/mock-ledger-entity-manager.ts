import type { EntityManager } from "typeorm";

/** Minimal EntityManager stub for unit tests that persist ledger journals. */
export function mockLedgerPersistEntityManager(): EntityManager {
  return {
    query: async (sql: string) => {
      if (sql.includes("INSERT INTO ledger_journal_lines")) {
        return [{ id: "line-inserted" }];
      }
      return [];
    }
  } as unknown as EntityManager;
}
