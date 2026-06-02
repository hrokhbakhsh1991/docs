import type { MutableRefObject } from "react";

function deepEqualForLoopDebug(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (a == null || b == null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqualForLoopDebug(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  if (typeof a === "object") {
    if (typeof b !== "object") {
      return false;
    }
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) {
        return false;
      }
      if (!deepEqualForLoopDebug(aObj[key], bObj[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

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
  _label: string,
  _detail?: Record<string, unknown>,
): void {
  const now = Date.now();
  const deltaMs = lastDenaliSyncAt > 0 ? now - lastDenaliSyncAt : null;
  lastDenaliSyncAt = now;
  if (deltaMs != null && deltaMs < RAPID_SYNC_WINDOW_MS && typeof console !== "undefined") {
  }
}
