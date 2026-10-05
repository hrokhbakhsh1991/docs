import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  advanceCancellationEffectStatus,
  buildCancellationSnapshot,
  readCancellationTransportImpact,
  readCancellationWorkState,
  summarizeCancellationWork,
  updateCancellationSnapshotEffect,
} from "./cancellation-work-state.ts";

describe("cancellation work state", () => {
  it("creates a durable pending intent and preserves lifecycle audit fields", () => {
    const snapshot = buildCancellationSnapshot({
      previousStatus: "approved",
      previousFinalizationStatus: "finalized",
      previousPaymentStatus: "paid",
      partySize: 2,
      finalizedAt: "2026-10-01T08:00:00.000Z",
      departureAt: "2026-10-10T08:00:00.000Z",
      updatedAt: "2026-10-05T08:00:00.000Z",
    });

    assert.equal(snapshot.previousStatus, "approved");
    assert.equal(snapshot.previousPaymentStatus, "paid");
    assert.deepEqual(readCancellationWorkState(snapshot), {
      paymentHold: "pending",
      transportSettlement: "pending",
      refund: "pending",
      notification: "pending",
      waitlistReview: "pending",
      updatedAt: "2026-10-05T08:00:00.000Z",
    });
  });

  it("updates one effect without erasing other checkpoints", () => {
    const snapshot = buildCancellationSnapshot({
      previousStatus: "approved",
      previousFinalizationStatus: "not_final",
      previousPaymentStatus: "partial",
      partySize: 1,
      finalizedAt: null,
      departureAt: "2026-10-10T08:00:00.000Z",
      updatedAt: "2026-10-05T08:00:00.000Z",
    });
    const updated = updateCancellationSnapshotEffect({
      snapshot,
      effect: "refund",
      status: "manual_review",
      updatedAt: "2026-10-05T08:01:00.000Z",
      transportImpact: {
        affectedDriverRegistrationIds: ["driver-1"],
        affectedPassengerRegistrationIds: ["passenger-1"],
      },
    });

    assert.equal(updated.previousStatus, "approved");
    assert.deepEqual(readCancellationWorkState(updated), {
      paymentHold: "pending",
      transportSettlement: "pending",
      refund: "manual_review",
      notification: "pending",
      waitlistReview: "pending",
      updatedAt: "2026-10-05T08:01:00.000Z",
    });
    const merged = updateCancellationSnapshotEffect({
      snapshot: updated,
      effect: "notification",
      status: "completed",
      updatedAt: "2026-10-05T08:02:00.000Z",
      transportImpact: {
        affectedDriverRegistrationIds: ["driver-1", "driver-2"],
        affectedPassengerRegistrationIds: ["passenger-1"],
      },
    });
    assert.deepEqual(readCancellationTransportImpact(merged), {
      affectedDriverRegistrationIds: ["driver-1", "driver-2"],
      affectedPassengerRegistrationIds: ["passenger-1"],
    });
  });

  it("does not let stale retries regress terminal or actionable checkpoints", () => {
    assert.equal(advanceCancellationEffectStatus("completed", "pending"), "completed");
    assert.equal(advanceCancellationEffectStatus("completed", "manual_review"), "completed");
    assert.equal(advanceCancellationEffectStatus("not_required", "pending"), "not_required");
    assert.equal(advanceCancellationEffectStatus("manual_review", "pending"), "manual_review");
    assert.equal(advanceCancellationEffectStatus("manual_review", "completed"), "completed");
  });

  it("reopens completed notification work only when a new affected recipient is captured", () => {
    const completed = updateCancellationSnapshotEffect({
      snapshot: buildCancellationSnapshot({
        previousStatus: "approved",
        previousFinalizationStatus: "finalized",
        previousPaymentStatus: "paid",
        partySize: 1,
        finalizedAt: "2026-10-01T08:00:00.000Z",
        departureAt: "2026-10-10T08:00:00.000Z",
        updatedAt: "2026-10-05T08:00:00.000Z",
      }),
      effect: "notification",
      status: "completed",
      updatedAt: "2026-10-05T08:01:00.000Z",
      transportImpact: {
        affectedDriverRegistrationIds: ["driver-1"],
        affectedPassengerRegistrationIds: [],
      },
    });
    const sameRecipients = updateCancellationSnapshotEffect({
      snapshot: completed,
      effect: "notification",
      status: "pending",
      updatedAt: "2026-10-05T08:02:00.000Z",
      transportImpact: {
        affectedDriverRegistrationIds: ["driver-1"],
        affectedPassengerRegistrationIds: [],
      },
    });
    assert.equal(readCancellationWorkState(sameRecipients)?.notification, "completed");

    const newRecipient = updateCancellationSnapshotEffect({
      snapshot: sameRecipients,
      effect: "notification",
      status: "pending",
      updatedAt: "2026-10-05T08:03:00.000Z",
      transportImpact: {
        affectedDriverRegistrationIds: ["driver-1", "driver-2"],
        affectedPassengerRegistrationIds: [],
      },
    });
    assert.equal(readCancellationWorkState(newRecipient)?.notification, "pending");
  });

  it("fails closed when a persisted work snapshot is incomplete", () => {
    assert.equal(readCancellationWorkState({ work: { refund: "completed" } }), null);
    assert.equal(
      readCancellationTransportImpact({
        transportImpact: { affectedDriverRegistrationIds: ["driver-1"] },
      }),
      null
    );
  });

  it("summarizes manual review, explicit waitlist work, and late correction", () => {
    const base = {
      paymentHold: "completed",
      transportSettlement: "completed",
      refund: "completed",
      notification: "completed",
      waitlistReview: "not_required",
      updatedAt: "2026-10-05T08:00:00.000Z",
    } as const;
    assert.equal(
      summarizeCancellationWork({
        work: { ...base, notification: "manual_review" },
        cancellationApprovedAt: "2026-10-05T08:00:00.000Z",
        departureAt: "2026-10-10T08:00:00.000Z",
      }),
      "manual_review"
    );
    assert.equal(
      summarizeCancellationWork({
        work: { ...base, waitlistReview: "pending" },
        cancellationApprovedAt: "2026-10-05T08:00:00.000Z",
        departureAt: "2026-10-10T08:00:00.000Z",
      }),
      "applied"
    );
    assert.equal(
      summarizeCancellationWork({
        work: base,
        cancellationApprovedAt: "2026-10-11T08:00:00.000Z",
        departureAt: "2026-10-10T08:00:00.000Z",
      }),
      "late_correction"
    );
    assert.equal(
      summarizeCancellationWork({
        work: base,
        cancellationApprovedAt: "2026-10-05T08:00:00.000Z",
        departureAt: "2026-10-10T08:00:00.000Z",
      }),
      "completed"
    );
  });
});
