/** Track C — draft unification rollout (off → shadow → on). */

export type DraftUnificationV3Mode = "off" | "shadow" | "on";

const VALID_MODES = new Set<DraftUnificationV3Mode>(["off", "shadow", "on"]);

function normalizeMode(raw: string | undefined): DraftUnificationV3Mode | undefined {
  const trimmed = raw?.trim().toLowerCase();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }
  if (VALID_MODES.has(trimmed as DraftUnificationV3Mode)) {
    return trimmed as DraftUnificationV3Mode;
  }
  return undefined;
}

export function resolveDraftUnificationV3Mode(): DraftUnificationV3Mode {
  const fromPublic = normalizeMode(process.env.NEXT_PUBLIC_DRAFT_UNIFICATION_V3);
  if (fromPublic !== undefined) {
    return fromPublic;
  }
  const fromServer = normalizeMode(process.env.DRAFT_UNIFICATION_V3);
  if (fromServer !== undefined) {
    return fromServer;
  }
  return "off";
}

export function isDraftUnificationV3ServerWins(mode: DraftUnificationV3Mode = resolveDraftUnificationV3Mode()): boolean {
  return mode === "on";
}
