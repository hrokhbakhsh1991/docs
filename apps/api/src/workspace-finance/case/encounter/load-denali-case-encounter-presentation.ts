/**
 * Load Denali Case Encounter presentation for operators (PR12-A / PR14-B).
 * Authz → compose → execute → project → presentation DTO only.
 */

import { deriveFinanceCaseCommandCapability } from "@app-tour/finance-http-contracts";

import type { FinanceActorContext } from "../../ports/finance-actor-context";
import type { DenaliCaseCapabilityConfig } from "../compose-denali-case-providers";
import {
  loadEnrollmentCaseEncounter,
  type LoadEnrollmentCaseEncounterInput,
} from "../command-bridge/load-enrollment-encounter";
import { caseOutputMeaningFingerprint } from "../command-bridge/stale-intent-guard";
import type {
  CaseEncounterPresentation,
  CaseEncounterPresentationResponse,
} from "./case-encounter-presentation";
import {
  authorizeCaseEncounterView,
  CaseEncounterViewAuthzDeniedError,
  type CaseEncounterViewAuthorizer,
} from "./authorize-case-encounter-view";
import {
  assertPresentationBoundary,
  toCaseEncounterPresentation,
} from "./to-case-encounter-presentation";

export type { CaseEncounterPresentationResponse };

export type LoadDenaliCaseEncounterPresentationInput = {
  readonly auth: FinanceActorContext;
  readonly authorization: CaseEncounterViewAuthorizer;
  readonly registrationId: string;
  readonly counterpartyId: string;
  readonly readDeps: LoadEnrollmentCaseEncounterInput["readDeps"];
  readonly capability?: DenaliCaseCapabilityConfig;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly executionId?: string;
};

export class CaseEncounterNotFoundError extends Error {
  readonly code = "CASE_ENCOUNTER_NOT_FOUND" as const;
  constructor(message = "CASE_ENCOUNTER_NOT_FOUND") {
    super(message);
    this.name = "CaseEncounterNotFoundError";
  }
}

/**
 * Host-owned loader. Never returns CaseOutput / FactSnapshot / SoT DTOs.
 */
export async function loadDenaliCaseEncounterPresentation(
  input: LoadDenaliCaseEncounterPresentationInput
): Promise<CaseEncounterPresentationResponse> {
  authorizeCaseEncounterView(input.authorization, input.auth);

  const booking = await input.readDeps.bookings.getById(
    input.registrationId,
    input.auth.tenantId
  );
  if (booking === null) {
    throw new CaseEncounterNotFoundError();
  }

  if (booking.tenantId !== input.auth.tenantId) {
    throw new CaseEncounterViewAuthzDeniedError("tenant_mismatch");
  }

  const loaded = await loadEnrollmentCaseEncounter({
    tenantId: input.auth.tenantId,
    registrationId: input.registrationId,
    counterpartyId: input.counterpartyId || booking.submittedByUserId || "unknown",
    readDeps: input.readDeps,
    capability: input.capability,
    env: input.env,
    executionId: input.executionId,
  });

  const encounter = toCaseEncounterPresentation(loaded.encounter);
  assertPresentationBoundary(encounter);
  return {
    encounter,
    executionId: loaded.executionId,
    meaningFingerprint: caseOutputMeaningFingerprint(loaded.caseOutput),
    ...(loaded.providerObservation !== undefined
      ? { providerObservation: loaded.providerObservation }
      : {}),
  };
}

/** Helper for tests / Host HTTP — capability from presentation allow list. */
export function commandCapabilityFromEncounter(encounter: CaseEncounterPresentation) {
  return deriveFinanceCaseCommandCapability(encounter.allow);
}
