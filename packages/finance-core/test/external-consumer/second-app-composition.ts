/**
 * Simulated second application composition root.
 * Depends only on the published package name (@app-tour/finance-core → dist).
 */
import { createFinanceService, type FinanceService } from "@app-tour/finance-core";

import {
  ExternalAuthz,
  ExternalCapability,
  ExternalClock,
  ExternalDisplay,
  ExternalLogger,
  ExternalMetrics,
  ExternalProof,
  ExternalReceiptDefaults,
  ExternalSchedules,
  ExternalStorage,
  createExternalBookingPort,
  createExternalLedgerPolicy,
  createExternalRepository,
} from "./adapters.ts";

/** Compose finance-core the way a second application repository would. */
export function createExternalAppFinanceService(): FinanceService {
  return createFinanceService(
    createExternalLedgerPolicy(),
    createExternalRepository(),
    createExternalBookingPort(),
    ExternalReceiptDefaults,
    ExternalDisplay,
    ExternalMetrics,
    ExternalStorage,
    ExternalProof,
    ExternalCapability,
    ExternalAuthz,
    ExternalSchedules,
    ExternalLogger,
    ExternalClock
  );
}
