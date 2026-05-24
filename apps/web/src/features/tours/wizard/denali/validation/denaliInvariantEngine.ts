import { isDenaliAltitudeVisibleForCategory } from "../denaliAltitudeVisibility";
import { readDenaliCanonicalBasics } from "../denaliCanonicalBasicsControl";
import {
  computeDenaliTourDayCountFromKind,
  syncDenaliItineraryRows,
} from "../denaliItinerarySync";
import { resolveDenaliRuleModelFromForm, normalizeDenaliWizardForm } from "./denaliRuleAccess";
import { isDenaliFieldVisibleInModel, type DenaliUIContextOptions } from "../rules/denaliUIAdapter";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { DenaliTourKind } from "@repo/types";

/**
 * Denali Invariant Engine (map.md §Phase 1).
 *
 * Central gate for all state mutations. Ensures no ghost data persists
 * across kind switches, draft restores, or step transitions.
 */

/** Normalize hidden leaves after structural cleanup. */
export function getDenaliSafeFormState(
  form: DenaliCreateTourWizardForm,
  _uiOptions?: DenaliUIContextOptions,
): DenaliCreateTourWizardForm {
  return normalizeDenaliWizardForm(form, _uiOptions);
}

/**
 * Applies invariants to a form state and returns the result.
 */
function applyDenaliStructuralInvariants(
  form: DenaliCreateTourWizardForm,
  _uiOptions?: DenaliUIContextOptions,
): DenaliCreateTourWizardForm {
  const next = {
    ...form,
    basicInfo: { ...form.basicInfo },
    programNature: { ...form.programNature },
    transport: { ...form.transport },
    participantRequirements: { ...form.participantRequirements },
  };

  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);
  if (!isDenaliAltitudeVisibleForCategory(basics?.category)) {
    next.programNature.altitudeMeasurement = undefined;
  }

  if (basics?.category === "mountain") {
    next.participantRequirements.sportsInsuranceRequired = true;
  }

  if (next.transport.transportMode === "none" || next.transport.transportMode === "shared_cars") {
    next.transport.transportCost = undefined;
  }

  const dongVisible = next.transport.transportMode === "shared_cars" || (
    (next.transport.transportMode === "bus" || next.transport.transportMode === "minibus" || next.transport.transportMode === "train") &&
    next.transport.allowPersonalCar === true
  );

  if (!dongVisible) {
    next.transport.dongAmount = undefined;
  }

  const isMulti = basics?.duration === "multi_day";
  if (!isMulti) {
    next.programNature.itinerary = undefined;
  } else {
    const dayCount = computeDenaliTourDayCountFromKind(
      form.basicInfo.tourType as DenaliTourKind | undefined,
      form.basicInfo.startDateTime ?? "",
      form.basicInfo.endDateTime,
    );
    next.programNature.itinerary = syncDenaliItineraryRows(
      next.programNature.itinerary,
      dayCount,
    );
  }

  const model = resolveDenaliRuleModelFromForm(next);
  if (
    model != null &&
    isDenaliFieldVisibleInModel(model, "program.difficultyLevel", next, _uiOptions) &&
    next.programNature.difficultyLevel == null
  ) {
    next.programNature.difficultyLevel = 5;
  }

  return next;
}

export function applyDenaliInvariantState(
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
): DenaliCreateTourWizardForm {
  return getDenaliSafeFormState(
    applyDenaliStructuralInvariants(form, uiOptions),
    uiOptions,
  );
}
