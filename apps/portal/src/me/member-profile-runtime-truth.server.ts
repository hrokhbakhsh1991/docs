import { MEMBER_PROFILE_FIELD_IDS } from "@app-tour/workspace-sdk";

import { listBffIdentityMappedFieldIds } from "./member-profile-bff.server";
import { getMemberProfileCacheStore } from "./member-profile-cache-store.server";
import {
  assertMemberProfileContractSnapshotAlignment,
  readMemberProfileContractSnapshot,
} from "./member-profile-contract-alignment.server";
import type { SerializableMemberProfileCapabilities } from "./member-profile-types";

let runtimeTruthChecked = false;

export type MemberProfileEnforcementMode = "warn" | "strict";

export type MemberProfileRuntimeDriftType =
  | "contract_version_mismatch"
  | "snapshot_sdk_mismatch"
  | "sdk_bff_mapping_mismatch"
  | "identity_exposure_mismatch"
  | "runtime_truth_cache_store"
  | "runtime_truth_alignment_failed";

export type MemberProfileRuntimeEnforcementContext = {
  readonly traceId?: string;
  readonly contractVersion: string;
  readonly capabilities: SerializableMemberProfileCapabilities;
  readonly mappedFieldIds: readonly string[];
  readonly responseFieldIds: readonly string[];
};

export type MemberProfileRuntimeEnforcementResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "PROFILE_ARCHITECTURE_DRIFT_DETECTED";
      readonly driftType: MemberProfileRuntimeDriftType;
    };

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function readSdkFieldIds(): string[] {
  return sortedUnique(MEMBER_PROFILE_FIELD_IDS);
}

function listCapabilityExposedFieldIds(
  capabilities: SerializableMemberProfileCapabilities
): string[] {
  return sortedUnique([...capabilities.editableFields, ...capabilities.readOnlyFields]);
}

export function resolveMemberProfileEnforcementMode(): MemberProfileEnforcementMode {
  return process.env.MEMBER_PROFILE_ENFORCEMENT_MODE === "strict" ? "strict" : "warn";
}

function logMemberProfileEnforcementEvent(input: {
  readonly level: "WARNING" | "ERROR";
  readonly enforcementMode: MemberProfileEnforcementMode;
  readonly contractVersion: string;
  readonly driftType: MemberProfileRuntimeDriftType;
  readonly traceId?: string;
  readonly message: string;
}): void {
  const payload = {
    scope: "portal.member-profile.enforcement",
    level: input.level,
    at: new Date().toISOString(),
    enforcementMode: input.enforcementMode,
    contractVersion: input.contractVersion,
    driftType: input.driftType,
    traceId: input.traceId ?? "unspecified",
    message: input.message,
  };
  if (input.level === "ERROR") {
    console.error(JSON.stringify(payload));
    return;
  }
  console.warn(JSON.stringify(payload));
}

function collectRuntimeArchitectureDrifts(
  context: MemberProfileRuntimeEnforcementContext
): Array<{ readonly driftType: MemberProfileRuntimeDriftType; readonly message: string }> {
  const drifts: Array<{ readonly driftType: MemberProfileRuntimeDriftType; readonly message: string }> = [];
  const snapshot = readMemberProfileContractSnapshot();
  const sdkFieldIds = readSdkFieldIds();
  const mappedFieldIds = sortedUnique(context.mappedFieldIds);
  const snapshotFieldIds = sortedUnique(snapshot.memberProfileFieldIds);
  const exposedFieldIds = listCapabilityExposedFieldIds(context.capabilities);
  const responseFieldIds = sortedUnique(context.responseFieldIds);

  if (context.contractVersion !== snapshot.contractVersion) {
    drifts.push({
      driftType: "contract_version_mismatch",
      message: `Response contractVersion ${context.contractVersion} does not match snapshot ${snapshot.contractVersion}`,
    });
  }

  if (snapshotFieldIds.join("|") !== sdkFieldIds.join("|")) {
    drifts.push({
      driftType: "snapshot_sdk_mismatch",
      message: "Snapshot memberProfileFieldIds diverge from SDK field-id union",
    });
  }

  if (sdkFieldIds.join("|") !== mappedFieldIds.join("|")) {
    drifts.push({
      driftType: "sdk_bff_mapping_mismatch",
      message: "SDK field-id union diverges from BFF identity field readers",
    });
  }

  for (const fieldId of exposedFieldIds) {
    if (!mappedFieldIds.includes(fieldId)) {
      drifts.push({
        driftType: "sdk_bff_mapping_mismatch",
        message: `Capability-exposed field "${fieldId}" is not mapped in BFF identity readers`,
      });
    }
  }

  if (exposedFieldIds.join("|") !== responseFieldIds.join("|")) {
    drifts.push({
      driftType: "identity_exposure_mismatch",
      message: "Response profile.fields keys do not match capability-exposed field set",
    });
  }

  return drifts;
}

/** Per-request closed-loop enforcement (M8). Default warn; strict rejects drift. */
export function enforceMemberProfileRuntimeTruth(
  context: MemberProfileRuntimeEnforcementContext
): MemberProfileRuntimeEnforcementResult {
  const enforcementMode = resolveMemberProfileEnforcementMode();
  const drifts = collectRuntimeArchitectureDrifts(context);

  for (const drift of drifts) {
    logMemberProfileEnforcementEvent({
      level: enforcementMode === "strict" ? "ERROR" : "WARNING",
      enforcementMode,
      contractVersion: context.contractVersion,
      driftType: drift.driftType,
      traceId: context.traceId,
      message: drift.message,
    });
  }

  if (drifts.length > 0 && enforcementMode === "strict") {
    return {
      ok: false,
      code: "PROFILE_ARCHITECTURE_DRIFT_DETECTED",
      driftType: drifts[0].driftType,
    };
  }

  return { ok: true };
}

/** Non-blocking startup self-check (M7). Runs once per process. */
export function runMemberProfileRuntimeTruthCheck(traceId?: string): void {
  if (runtimeTruthChecked) {
    return;
  }
  runtimeTruthChecked = true;

  const enforcementMode = resolveMemberProfileEnforcementMode();
  const snapshot = readMemberProfileContractSnapshot();

  try {
    if (snapshot.contractVersion !== "v1") {
      logMemberProfileEnforcementEvent({
        level: "WARNING",
        enforcementMode,
        contractVersion: snapshot.contractVersion,
        driftType: "contract_version_mismatch",
        traceId,
        message: "Member profile contract snapshot is not v1",
      });
    }

    assertMemberProfileContractSnapshotAlignment();

    const store = getMemberProfileCacheStore();
    if (typeof store.read !== "function" || typeof store.write !== "function") {
      logMemberProfileEnforcementEvent({
        level: "WARNING",
        enforcementMode,
        contractVersion: snapshot.contractVersion,
        driftType: "runtime_truth_cache_store",
        traceId,
        message: "Member profile cache store is not wired",
      });
    }

    const mappedFieldIds = listBffIdentityMappedFieldIds();
    if (sortedUnique(snapshot.memberProfileFieldIds).join("|") !== sortedUnique(mappedFieldIds).join("|")) {
      logMemberProfileEnforcementEvent({
        level: "WARNING",
        enforcementMode,
        contractVersion: snapshot.contractVersion,
        driftType: "sdk_bff_mapping_mismatch",
        traceId,
        message: "Startup snapshot field ids diverge from BFF identity readers",
      });
    }
  } catch (error) {
    logMemberProfileEnforcementEvent({
      level: "WARNING",
      enforcementMode,
      contractVersion: snapshot.contractVersion,
      driftType: "runtime_truth_alignment_failed",
      traceId,
      message: error instanceof Error ? error.message : "Unknown runtime truth alignment failure",
    });
  }
}

export function buildMemberProfileRuntimeEnforcementContext(input: {
  readonly traceId: string;
  readonly contractVersion: string;
  readonly capabilities: SerializableMemberProfileCapabilities;
  readonly responseFieldIds: readonly string[];
}): MemberProfileRuntimeEnforcementContext {
  return {
    traceId: input.traceId,
    contractVersion: input.contractVersion,
    capabilities: input.capabilities,
    mappedFieldIds: listBffIdentityMappedFieldIds(),
    responseFieldIds: input.responseFieldIds,
  };
}
