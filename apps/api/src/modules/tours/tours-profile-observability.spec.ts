import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";

import { logTourFormProfileResolvedForCreate, logTourProfileInvariantRejected } from "./tours-profile-observability";

test("logTourFormProfileResolvedForCreate emits structured adoption fields", () => {
  const payloads: Record<string, unknown>[] = [];
  const logger = {
    info(_msg: string, meta: Record<string, unknown>) {
      payloads.push(meta);
    },
  };
  logTourFormProfileResolvedForCreate(logger as never, {
    op: "create_tour",
    tenant_id: "t-1",
    resolved_form_profile: "urban_event",
    resolution_source: "explicit_client",
  });
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0]!.event, "tour_form_profile_resolution");
  assert.equal(payloads[0]!.resolution_source, "explicit_client");
  assert.equal(payloads[0]!.resolved_form_profile, "urban_event");
});

test("logTourProfileInvariantRejected forwards BadRequest body fields", () => {
  const payloads: Record<string, unknown>[] = [];
  const logger = {
    warn(_msg: string, meta: Record<string, unknown>) {
      payloads.push(meta);
    },
  };
  const err = new BadRequestException({
    error: {
      code: "VALIDATION_PROFILE_TRANSPORT_NOT_ALLOWED",
      message: "transportModes must be empty for urban_event",
    },
  });
  logTourProfileInvariantRejected(
    logger as never,
    {
      op: "persisted_trip_details_validate",
      tenant_id: "t-1",
      tour_id: "tour-99",
      resolved_form_profile: "urban_event",
    },
    err,
  );
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0]!.event, "tour_profile_invariant_rejected");
  assert.equal(payloads[0]!.op, "persisted_trip_details_validate");
  assert.equal(payloads[0]!.error_code, "VALIDATION_PROFILE_TRANSPORT_NOT_ALLOWED");
  assert.equal(
    String(payloads[0]!.error_message),
    "transportModes must be empty for urban_event",
  );
});
