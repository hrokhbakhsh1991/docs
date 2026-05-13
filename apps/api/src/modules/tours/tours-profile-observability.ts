import { BadRequestException } from "@nestjs/common";

import type { LoggerService } from "../../common/logger/logger.service";
import type { TourFormProfile } from "@repo/types";

export type TourProfileInvariantRejectedPayload = {
  readonly op:
    | "create_tour_invariants"
    | "persisted_trip_details_validate"
    | "incoming_trip_details_patch_fragment";
  readonly tenant_id: string;
  readonly tour_id?: string;
  readonly resolved_form_profile: TourFormProfile;
  readonly error_code?: string;
  readonly error_message?: string;
};

function extractBadRequestFields(err: unknown): { code?: string; message?: string } {
  if (!(err instanceof BadRequestException)) {
    return {};
  }
  const body = err.getResponse();
  if (typeof body === "string") {
    return { message: body };
  }
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: { code?: string; message?: string } }).error;
    return { code: e?.code, message: e?.message };
  }
  return {};
}

/**
 * Structured **warn** when a profile-scoped invariant rejects the request. Called only
 * on the failure path (400) — not on successful creates/updates, so volume tracks
 * bad payloads only.
 */
export function logTourProfileInvariantRejected(
  logger: LoggerService,
  payload: TourProfileInvariantRejectedPayload,
  err: unknown,
): void {
  const { code, message } = extractBadRequestFields(err);
  logger.warn("tour.profile_invariant_rejected", {
    event: "tour_profile_invariant_rejected",
    ...payload,
    error_code: code,
    error_message: message,
  });
}

export type TourFormProfileResolutionPayload = {
  readonly op: "create_tour";
  readonly tenant_id: string;
  readonly resolved_form_profile: TourFormProfile;
  /** Which branch of `resolveTourFormProfileFromTripDetails` precedence won (Phase P9). */
  readonly resolution_source: "explicit_client" | "workspace_theme" | "tour_type_default";
};

/**
 * Structured **info** on successful profile resolution for `POST /tours` (adoption metric).
 * Safe to aggregate in log pipelines: count `resolution_source === "explicit_client"` vs others.
 */
export function logTourFormProfileResolvedForCreate(
  logger: LoggerService,
  payload: TourFormProfileResolutionPayload,
): void {
  logger.info("tour.form_profile_resolution", {
    event: "tour_form_profile_resolution",
    ...payload,
  });
}
