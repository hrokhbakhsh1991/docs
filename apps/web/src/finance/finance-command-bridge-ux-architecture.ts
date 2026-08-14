/**
 * PR18-A — Command Bridge UX architecture contracts (no mutation UI).
 *
 * Separates capability discovery from permission and intent from execution.
 * Does not call Host bridge, FinanceService, or gateways.
 */

import type { CaseCommandCapabilityContract } from "@app-tour/finance-case-encounter-ui";

/** Layers on the Commercial Meaning → Command Bridge surface. */
export type FinanceCommandBridgeUxLayer =
  | "discovery"
  | "permission"
  | "intent"
  | "execution";

/**
 * Discovery projection only — what Case-coherent tokens exist on this Meaning.
 * Never a permission grant and never an execute handle.
 */
export type FinanceCommandBridgeUxDiscovery = {
  readonly layer: "discovery";
  readonly supportedCommands: readonly string[];
  readonly availableTokens: readonly string[];
  readonly bridgeEndpoint: string | null;
  /** Hard lock: discovery never authorizes. */
  readonly grantsPermission: false;
  readonly mayExecute: false;
};

/** Future intent draft shape — architecture only; not posted by PR18-A. */
export type FinanceCommandBridgeUxIntentDraft = {
  readonly layer: "intent";
  readonly command: "reviewReceipt";
  readonly token: "approve_evidence" | "reject_evidence";
  readonly decision: "approve" | "reject";
  readonly registrationId: string;
  readonly sourceExecutionId: string;
  readonly meaningFingerprint?: string;
  readonly receiptId?: string;
};

export type FinanceCommandBridgeUxActionPhase =
  | "discover"
  | "select"
  | "confirm"
  | "submit"
  | "resolve"
  | "refresh";

export const FINANCE_COMMAND_BRIDGE_UX_ACTION_LIFECYCLE: readonly FinanceCommandBridgeUxActionPhase[] =
  ["discover", "select", "confirm", "submit", "resolve", "refresh"] as const;

/** Public failure classes future UX must handle (typed Host codes). */
export const FINANCE_COMMAND_BRIDGE_UX_FAILURE_CLASSES = [
  "auth_denied",
  "vocabulary_denied",
  "stale",
  "sot_rejected",
  "intent_invalid",
  "provider_unavailable",
  "reexecute_failed",
] as const;

export type FinanceCommandBridgeUxFailureClass =
  (typeof FINANCE_COMMAND_BRIDGE_UX_FAILURE_CLASSES)[number];

/** What Meaning / Command UX may render. */
export const FINANCE_COMMAND_BRIDGE_UX_MAY_DISPLAY = [
  "encounter_view_sections",
  "command_capability_metadata",
  "opaque_execution_id",
  "meaning_fingerprint",
  "typed_bridge_failure_codes",
] as const;

/** What UI must never infer or import. */
export const FINANCE_COMMAND_BRIDGE_UX_MUST_NEVER = [
  "capability_as_permission",
  "case_output",
  "fact_snapshot",
  "gateway_dto",
  "sot_row_as_meaning",
  "direct_finance_service_call",
  "optimistic_meaning_patch",
  "auto_execute_without_confirm",
] as const;

export type FinanceCommandBridgeUxReadinessDecision =
  | "NOT_READY"
  | "READY_FOR_UI_IMPLEMENTATION";

/** PR18-A architecture gate (buttons still require explicit approval to implement). */
export const FINANCE_COMMAND_BRIDGE_UX_READINESS: FinanceCommandBridgeUxReadinessDecision =
  "READY_FOR_UI_IMPLEMENTATION";

/**
 * Project capability metadata into discovery-only surface.
 * Empty / missing capability → no tokens; still never grants permission.
 */
export function projectCommandBridgeUxDiscovery(
  capability: CaseCommandCapabilityContract | null | undefined
): FinanceCommandBridgeUxDiscovery {
  if (capability == null) {
    return {
      layer: "discovery",
      supportedCommands: [],
      availableTokens: [],
      bridgeEndpoint: null,
      grantsPermission: false,
      mayExecute: false,
    };
  }
  return {
    layer: "discovery",
    supportedCommands: [...capability.supportedCommands],
    availableTokens: [...capability.reviewReceipt.availableTokens],
    bridgeEndpoint: capability.reviewReceipt.endpoint,
    grantsPermission: false,
    mayExecute: false,
  };
}

/**
 * Architecture lock: capability / discovery never answers "may this actor execute?"
 * Always false — Host authz is the only permission authority.
 */
export function commandCapabilityGrantsPermission(
  _capability: CaseCommandCapabilityContract | null | undefined
): false {
  return false;
}

/**
 * Architecture lock: UI modules must not treat discovery as an execute path.
 */
export function commandDiscoveryMayExecute(
  discovery: FinanceCommandBridgeUxDiscovery
): false {
  void discovery;
  return false;
}

/** Token is Case-coherent in discovery — still not permission to POST. */
export function isCommandTokenDiscovered(
  discovery: FinanceCommandBridgeUxDiscovery,
  token: string
): boolean {
  return discovery.availableTokens.includes(token);
}
