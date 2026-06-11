/**
 * Phase 9.5 — SDK registration ops manifest validation (DEC-P9-011).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateRegistrationOpsManifest,
  type RegistrationOpsManifest,
} from "../src/operator/bookings/registration-ops-manifest";

const baseManifest = {
  id: "test_ops",
  defaultView: "inbox_table",
  views: ["inbox_table"],
  statusPipeline: ["pending"],
  kpiCards: ["pending"],
  filters: ["search"],
  columns: {
    inbox_table: ["guest"],
    tour_board: { groupBy: "tourId", columns: ["pending"] },
  },
  actions: {
    approve: { ability: "operator.bookings.approve", outboxEvent: "registration.approved" },
    reject: { ability: "operator.bookings.approve" },
    promoteWaitlist: { ability: "operator.bookings.approve" },
    bulkApprove: { ability: "operator.bookings.approve", maxBatch: 5 },
  },
  leaderReviewAlias: { enabled: true, path: "/leader/review", query: "view=inbox_table" },
} satisfies RegistrationOpsManifest;

describe("bookings-ops-manifest.spec.ts — workspace-sdk", () => {
  it("SDK-9.5-01 validateRegistrationOpsManifest rejects unknown view", () => {
    assert.doesNotThrow(() => validateRegistrationOpsManifest(baseManifest));
    assert.throws(
      () =>
        validateRegistrationOpsManifest({
          ...baseManifest,
          views: ["inbox_table", "unknown_view"] as RegistrationOpsManifest["views"],
        }),
      /REGISTRATION_OPS_UNKNOWN_VIEW:unknown_view/
    );
  });
});
