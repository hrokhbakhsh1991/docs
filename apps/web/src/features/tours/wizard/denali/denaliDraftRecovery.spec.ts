import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  hasRecoverableDenaliFormPatch,
  hasRecoverableServerDenaliDraft,
  isRecoverableLocalDenaliDraft,
} from "./denaliDraftRecovery";

test("hasRecoverableDenaliFormPatch: empty defaults are not recoverable", () => {
  assert.equal(hasRecoverableDenaliFormPatch(buildDenaliTourCreateDefaultValues()), false);
});

test("hasRecoverableDenaliFormPatch: two empty gathering rows alone are not recoverable", () => {
  const patch = buildDenaliTourCreateDefaultValues();
  assert.equal(patch.tripDetails.logistics.gatheringPoints.length, 2);
  assert.equal(hasRecoverableDenaliFormPatch(patch), false);
});

test("hasRecoverableDenaliFormPatch: title makes draft recoverable", () => {
  const patch = buildDenaliTourCreateDefaultValues();
  patch.basicInfo.title = "تور تست";
  assert.equal(hasRecoverableDenaliFormPatch(patch), true);
});

test("hasRecoverableServerDenaliDraft: ignores empty payload", () => {
  assert.equal(
    hasRecoverableServerDenaliDraft({
      id: "1",
      currentStepIndex: 0,
      payload: buildDenaliTourCreateDefaultValues() as unknown as Record<string, unknown>,
      version: 1,
      updatedAt: new Date().toISOString(),
    }),
    false,
  );
});

test("isRecoverableLocalDenaliDraft: clone prefill is not recoverable via banner", () => {
  assert.equal(
    isRecoverableLocalDenaliDraft({
      formPatch: {
        basicInfo: {
          title: "cloned",
          tourType: "mountain_day",
          startDateTime: "2026-06-01T08:00:00.000Z",
          leaderUserIds: [],
          endDateTime: undefined,
          approximateReturnTime: undefined,
        },
      },
      wizardMeta: {
        sourceTourId: "tour-1",
        resolvedFormProfile: "denali_pilot",
        formProfileVersion: 1,
      },
    }),
    false,
  );
});
