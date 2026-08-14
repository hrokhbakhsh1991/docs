/**
 * PR17-C — Report-only Commercial Meaning feedback calibration.
 * Never mutates interpreter rules, Host mappings, or rollout flags.
 */

import type {
  ClassicVsMeaningDisagreementSample,
  CommercialMeaningClientEvent,
} from "./commercial-meaning-client-events";
import type { EncounterVerdictSample } from "./encounter-internal-rollout-health";

export type CommercialMeaningCalibrationClass =
  | "operator_confusion"
  | "incomplete"
  | "exception"
  | "classic_vs_meaning_disagreement";

export type CommercialMeaningCalibrationFinding = {
  readonly class: CommercialMeaningCalibrationClass;
  readonly count: number;
  readonly registrationIds: readonly string[];
  readonly note: string;
};

export type CommercialMeaningFeedbackCalibration = {
  readonly findings: readonly CommercialMeaningCalibrationFinding[];
  readonly sampleWindow: {
    readonly clientEvents: number;
    readonly meaningSamples: number;
    readonly disagreementSamples: number;
  };
  /** Hard lock — calibration never edits finance-core / Host mappings. */
  readonly mutatesInterpreter: false;
  readonly mutatesFlags: false;
};

export type CalibrateCommercialMeaningFeedbackInput = {
  readonly clientEvents: readonly CommercialMeaningClientEvent[];
  readonly meaningSamples?: readonly EncounterVerdictSample[];
  readonly disagreementSamples?: readonly ClassicVsMeaningDisagreementSample[];
  /** Max registration ids retained per finding (report size bound). */
  readonly maxIdsPerFinding?: number;
};

function takeIds(ids: readonly string[], max: number): readonly string[] {
  const unique = [...new Set(ids)];
  return unique.slice(0, max);
}

/**
 * Classify operator feedback clusters for manual ops review.
 */
export function calibrateCommercialMeaningFeedback(
  input: CalibrateCommercialMeaningFeedbackInput
): CommercialMeaningFeedbackCalibration {
  const maxIds = input.maxIdsPerFinding ?? 25;
  const events = input.clientEvents;
  const samples = input.meaningSamples ?? [];
  const disagreements = input.disagreementSamples ?? [];
  const findings: CommercialMeaningCalibrationFinding[] = [];

  const returned = events.filter((e) => e.name === "operator_returned_to_operational_view");
  const unavailable = events.filter((e) => e.name === "meaning_unavailable");
  const opened = events.filter((e) => e.name === "meaning_opened");
  const confusionIds = [
    ...returned.map((e) => e.registrationId),
    ...unavailable
      .filter((e) => (e.reason ?? "").toLowerCase().includes("confus") === false)
      .filter((e) => {
        const reason = (e.reason ?? "").toLowerCase();
        return !reason.includes("authz") && !reason.includes("forbidden") && !reason.includes("503");
      })
      .map((e) => e.registrationId),
  ];
  // High bounce: returned without viewed, or many returns relative to opens
  const viewedRegs = new Set(
    events.filter((e) => e.name === "meaning_viewed").map((e) => e.registrationId)
  );
  const bounceWithoutView = returned
    .filter((e) => !viewedRegs.has(e.registrationId))
    .map((e) => e.registrationId);
  const confusionPool = [...confusionIds, ...bounceWithoutView];
  if (confusionPool.length > 0 || (opened.length > 0 && returned.length / opened.length >= 0.4)) {
    findings.push({
      class: "operator_confusion",
      count: Math.max(confusionPool.length, returned.length),
      registrationIds: takeIds(confusionPool.length > 0 ? confusionPool : returned.map((e) => e.registrationId), maxIds),
      note: "Operators returned to Operational View and/or hit non-authz unavailable — review UX guidance, not interpreter auto-edit.",
    });
  }

  const incompleteEvents = events.filter((e) => e.name === "meaning_incomplete");
  const incompleteSamples = samples.filter(
    (s) =>
      s.completenessClass.includes("inspect") ||
      s.reading === "INCOMPLETE_INSPECT" ||
      (s.surfaceState ?? "") === "incomplete"
  );
  const incompleteIds = [
    ...incompleteEvents.map((e) => e.registrationId),
    ...incompleteSamples.map((s) => s.registrationId),
  ];
  if (incompleteIds.length > 0) {
    findings.push({
      class: "incomplete",
      count: incompleteIds.length,
      registrationIds: takeIds(incompleteIds, maxIds),
      note: "Incomplete / inspect-forced Meaning surfaces — coverage residual; do not auto-relax completeness gates.",
    });
  }

  const exceptionSamples = samples.filter((s) => s.reading === "EXCEPTION");
  if (exceptionSamples.length > 0) {
    findings.push({
      class: "exception",
      count: exceptionSamples.length,
      registrationIds: takeIds(
        exceptionSamples.map((s) => s.registrationId),
        maxIds
      ),
      note: "EXCEPTION readings — treat as commercial signal; calibrate Host/SoT policy manually (see semantic calibration).",
    });
  }

  const realDisagreements = disagreements.filter(
    (d) => d.classicLabel.trim().toLowerCase() !== d.meaningReading.trim().toLowerCase()
  );
  if (realDisagreements.length > 0) {
    findings.push({
      class: "classic_vs_meaning_disagreement",
      count: realDisagreements.length,
      registrationIds: takeIds(
        realDisagreements.map((d) => d.registrationId),
        maxIds
      ),
      note: "Classic finance label ≠ Commercial Meaning reading — report-only; Decision A keeps Case as meaning authority.",
    });
  }

  return {
    findings,
    sampleWindow: {
      clientEvents: events.length,
      meaningSamples: samples.length,
      disagreementSamples: disagreements.length,
    },
    mutatesInterpreter: false,
    mutatesFlags: false,
  };
}
