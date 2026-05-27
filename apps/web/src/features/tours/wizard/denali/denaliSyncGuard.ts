import type { MutableRefObject } from "react";

import { deepEqualForLoopDebug } from "@/lib/debug-session-log";

/** Deep equality for Denali wizard / canonical snapshots (no lodash dependency). */
export function denaliStateEqual(a: unknown, b: unknown): boolean {
  return deepEqualForLoopDebug(a, b);
}

export type DenaliWizardSyncGuardRefs = {
  /** True while programmatic canonical → RHF hydration runs. */
  isHydrating: MutableRefObject<boolean>;
  /** True while draft-engine / reset re-hydration is in flight (blocks syncToken effects). */
  isRemoteHydration: MutableRefObject<boolean>;
};

const RAPID_SYNC_WINDOW_MS = 50;
let lastDenaliSyncAt = 0;

/** Logs only when two sync operations occur within 50ms (infinite-loop signature). */
export function logRapidDenaliSyncLoop(
  label: string,
  detail?: Record<string, unknown>,
): void {
  const now = Date.now();
  const deltaMs = lastDenaliSyncAt > 0 ? now - lastDenaliSyncAt : null;
  lastDenaliSyncAt = now;
  if (deltaMs != null && deltaMs < RAPID_SYNC_WINDOW_MS && typeof console !== "undefined") {
    console.warn("[DenaliSyncLoop] rapid sync detected", {
      label,
      deltaMs,
      ...detail,
    });
  }
}
