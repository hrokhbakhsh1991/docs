import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { requireActiveTenantId } from "../tenant/tenant-request-context";
import {
  validateCanonicalBeforePersist,
  type ValidateBeforePersistInput,
} from "../tours/canonical-validation";
import { runScheduledValidation } from "./validation-scheduler";
import {
  enrichValidationFailure,
  throwValidationFailure,
  ValidationFailure,
} from "./validation-failure";

type ValidationGate = {
  readonly tenantId: string;
};

const openGates = new Map<string, ValidationGate>();

/**
 * RULE-003 / P5-2 — full plugin + schema validation before any persist or
 * {@link withCanonicalTransaction} may open (see consumePreTransactionValidationGate).
 * Runs inside {@link runScheduledValidation} (DEC-016).
 * Gate is keyed per tenant (HT-03) — not a process-global scalar.
 */
export async function runPreTransactionValidation(
  input: ValidateBeforePersistInput
): Promise<CanonicalDocument> {
  return runScheduledValidation(input.tenantId, async () => {
    const activeTenant = requireActiveTenantId();
    if (activeTenant !== input.tenantId.trim()) {
      throw new Error("CANONICAL_VALIDATION_TENANT_MISMATCH");
    }
    try {
      const canonical = await validateCanonicalBeforePersist(input);
      openGates.set(input.tenantId, { tenantId: input.tenantId });
      return canonical;
    } catch (error) {
      openGates.delete(input.tenantId);
      if (error instanceof ValidationFailure) {
        throw enrichValidationFailure(error);
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("CANONICAL_VALIDATION_FAILED")) {
        throwValidationFailure(message);
      }
      throw error;
    }
  });
}

/**
 * Called from {@link withCanonicalTransaction} — refuses to open a TX without prior validation.
 */
export function consumePreTransactionValidationGate(tenantId: string): void {
  const gate = openGates.get(tenantId);
  if (gate === undefined || gate.tenantId !== tenantId) {
    throw new Error("CANONICAL_TX_VALIDATION_GATE_REQUIRED");
  }
  openGates.delete(tenantId);
}

/** Clears gate after non-transactional persist (Phase 4 path) or on validation failure cleanup. */
export function clearPreTransactionValidationGate(tenantId?: string): void {
  if (tenantId !== undefined) {
    openGates.delete(tenantId.trim());
    return;
  }
  openGates.clear();
}

/** Test-only — inspect gate without consuming. */
export function isPreTransactionValidationGateOpenForTests(tenantId: string): boolean {
  return openGates.get(tenantId)?.tenantId === tenantId;
}

function parseValidateDelayMsForTests(): number {
  if (process.env.NODE_ENV !== "test") {
    return 0;
  }
  const raw = process.env.P5_VALIDATE_DELAY_MS?.trim();
  if (!raw) {
    return 0;
  }
  const ms = Number.parseInt(raw, 10);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Test-only — simulates slow RuleEngine after sync validation, before any TX opens.
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-013
 */
export async function awaitPreTransactionValidationDelayForTests(): Promise<void> {
  const ms = parseValidateDelayMsForTests();
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
