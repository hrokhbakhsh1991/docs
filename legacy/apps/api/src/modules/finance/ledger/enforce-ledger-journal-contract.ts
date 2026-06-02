import { BadRequestException } from "@nestjs/common";
import {
  assertLedgerJournalDoubleEntry,
  LedgerJournalSchema,
} from "@repo/shared-contracts";
import { ZodError } from "zod";

import {
  toLedgerJournalContractStrict,
  validateLedgerEntry,
} from "./ledger.adapter";
import type { LedgerJournalLine } from "./ledger-journal-line";

export const LEDGER_CONTRACT_VALIDATION_FAILED = "LEDGER_CONTRACT_VALIDATION_FAILED" as const;

function ledgerContractErrorBody(
  operation: string,
  error: unknown,
): { code: string; message: string; details: unknown } {
  if (error instanceof ZodError) {
    return {
      code: LEDGER_CONTRACT_VALIDATION_FAILED,
      message: `Ledger journal failed contract validation (${operation})`,
      details: error.issues,
    };
  }
  return {
    code: LEDGER_CONTRACT_VALIDATION_FAILED,
    message: `Ledger journal failed contract validation (${operation}): ${
      error instanceof Error ? error.message : String(error)
    }`,
    details: {},
  };
}

/** True when {@link BadRequestException} carries {@link LEDGER_CONTRACT_VALIDATION_FAILED}. */
export function isLedgerContractValidationFailure(error: unknown): boolean {
  if (!(error instanceof BadRequestException)) {
    return false;
  }
  const body = error.getResponse();
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return false;
  }
  const code = (body as { error?: { code?: string } }).error?.code;
  return code === LEDGER_CONTRACT_VALIDATION_FAILED;
}

/**
 * Strict enforcement — {@link LedgerJournalSchema} + double-entry balance before journal persist.
 * Does not run parity warn mode; failures abort the caller transaction.
 */
export function enforceLedgerJournalContract(
  lines: readonly LedgerJournalLine[],
  operation: string,
): void {
  if (lines.length === 0) {
    return;
  }

  try {
    const journal = toLedgerJournalContractStrict(lines);
    assertLedgerJournalDoubleEntry(journal.lines, {
      journalId: journal.journalId,
      tenantId: journal.tenantId,
    });
    for (const entry of journal.lines) {
      validateLedgerEntry(entry);
    }
    LedgerJournalSchema.parse(journal);
  } catch (error) {
    throw new BadRequestException({
      error: ledgerContractErrorBody(operation, error),
    });
  }
}
