/**
 * PR19 — Controlled production rollout safety (fail-closed, report-only).
 * Never mutates flags; callers decide whether to enable chrome.
 */

export type ControlledProductionRolloutSafetyInput = {
  readonly sessionTenantId: string;
  readonly encounterMode: string | undefined;
  readonly encounterInternalTenants: string | undefined;
  readonly commandUiEnabled: string | undefined;
  readonly commandUiTenant: string | undefined;
  readonly shadowEnabled: string | undefined;
  readonly emergencyDisable: string | undefined;
};

export type ControlledProductionRolloutSafety = {
  readonly ok: boolean;
  readonly reasons: readonly string[];
  readonly commandUiAllowed: boolean;
  readonly encounterAllowed: boolean;
  readonly shadowOff: boolean;
  readonly singleCommandTenant: string | null;
  readonly mutatesFlags: false;
};

function truthy(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function parseSingleTenant(raw: string | undefined): string | null {
  const configured = (raw ?? "").trim();
  if (configured.length === 0) return null;
  if (configured.includes(",")) return null;
  return configured;
}

/**
 * Fail closed on empty / multi Command UI tenant, Encounter↔Command mismatch,
 * emergency disable, or shadow unexpectedly on during PR19 observation.
 */
export function evaluateControlledProductionRolloutSafety(
  input: ControlledProductionRolloutSafetyInput
): ControlledProductionRolloutSafety {
  const reasons: string[] = [];
  const session = input.sessionTenantId.trim();

  if (truthy(input.emergencyDisable)) {
    reasons.push("emergency_disable");
  }

  const shadowOff = !truthy(input.shadowEnabled);
  if (!shadowOff) {
    reasons.push("shadow_must_remain_off");
  }

  const commandTenant = parseSingleTenant(input.commandUiTenant);
  const commandFlag = truthy(input.commandUiEnabled);
  if (commandFlag && commandTenant === null) {
    reasons.push("command_ui_tenant_empty_or_multi");
  }

  const encounterMode = (input.encounterMode ?? "").trim().toLowerCase();
  const encounterList = (input.encounterInternalTenants ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  let encounterAllowed = false;
  if (encounterMode === "internal" && encounterList.length > 0) {
    encounterAllowed = session.length > 0 && encounterList.includes(session);
    if (!encounterAllowed) {
      reasons.push("session_not_on_encounter_allowlist");
    }
  } else if (encounterMode === "disabled" || encounterMode === "") {
    reasons.push("encounter_not_internal");
  } else if (encounterList.length === 0 && encounterMode === "internal") {
    reasons.push("encounter_allowlist_empty");
  }

  if (commandFlag && commandTenant !== null) {
    if (session.length > 0 && session !== commandTenant) {
      reasons.push("session_command_tenant_mismatch");
    }
    if (encounterList.length > 0 && !encounterList.includes(commandTenant)) {
      reasons.push("command_tenant_not_on_encounter_allowlist");
    }
    if (encounterList.length === 1 && encounterList[0] !== commandTenant) {
      reasons.push("encounter_command_tenant_mismatch");
    }
  }

  const commandUiAllowed =
    commandFlag &&
    commandTenant !== null &&
    session === commandTenant &&
    !truthy(input.emergencyDisable) &&
    shadowOff &&
    encounterAllowed &&
    (encounterList.length === 0 || encounterList.includes(commandTenant));

  if (commandFlag && !commandUiAllowed && !reasons.includes("command_ui_blocked")) {
    reasons.push("command_ui_blocked");
  }

  const ok =
    shadowOff &&
    !truthy(input.emergencyDisable) &&
    (!commandFlag || commandUiAllowed) &&
    encounterAllowed;

  return {
    ok,
    reasons: [...new Set(reasons)],
    commandUiAllowed,
    encounterAllowed,
    shadowOff,
    singleCommandTenant: commandTenant,
    mutatesFlags: false,
  };
}
