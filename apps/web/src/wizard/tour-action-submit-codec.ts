/**
 * Thin Shell Phase 4ap — tour-action submit error wire codec.
 * Prefer package `capabilities.tourActionSubmit`; platform fallback understands
 * product-blind `TOUR_ACTION_ERROR:` tokens (no warm binder cache).
 */

import {
  resolveTourActionSubmitCapability,
  type WorkspacePlugin,
  type WorkspaceTourActionSubmitErrorPayload,
} from "@app-cloud/workspace-sdk";

export type TourActionSubmitErrorPayload = WorkspaceTourActionSubmitErrorPayload;

export const TOUR_ACTION_SUBMIT_ERROR_PREFIX = "TOUR_ACTION_ERROR:" as const;

/** Product-blind platform encode (Gap Closure B.4 shell-local wire). */
export function encodePlatformTourActionSubmitError(
  payload: TourActionSubmitErrorPayload
): string {
  return `${TOUR_ACTION_SUBMIT_ERROR_PREFIX}${JSON.stringify(payload)}`;
}

/** Product-blind platform decode. */
export function decodePlatformTourActionSubmitError(
  raw: string
): TourActionSubmitErrorPayload | null {
  if (!raw.startsWith(TOUR_ACTION_SUBMIT_ERROR_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      raw.slice(TOUR_ACTION_SUBMIT_ERROR_PREFIX.length)
    ) as TourActionSubmitErrorPayload;
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      typeof parsed.status !== "number" ||
      typeof parsed.code !== "string" ||
      typeof parsed.message !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function encodeTourActionSubmitErrorForPlugin(
  plugin: Pick<WorkspacePlugin, "capabilities">,
  payload: TourActionSubmitErrorPayload
): string {
  const codec = resolveTourActionSubmitCapability(plugin);
  if (codec != null) {
    return codec.encode(payload);
  }
  return encodePlatformTourActionSubmitError(payload);
}

export function decodeTourActionSubmitError(
  raw: string,
  plugin?: Pick<WorkspacePlugin, "capabilities">
): TourActionSubmitErrorPayload | null {
  const fromCapability = resolveTourActionSubmitCapability(plugin ?? {})?.decode(raw);
  if (fromCapability != null) {
    return fromCapability;
  }
  return decodePlatformTourActionSubmitError(raw);
}

/** @deprecated Prefer encodeTourActionSubmitErrorForPlugin(plugin, payload). */
export function encodeTourActionSubmitError(
  payload: TourActionSubmitErrorPayload
): string {
  return encodePlatformTourActionSubmitError(payload);
}
