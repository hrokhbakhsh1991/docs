import assert from "node:assert/strict";
import test from "node:test";

import {
  canAutoRetryTourWizardDraftSelfConflict,
  isTourWizardDraftOneVersionAhead,
  isTourWizardDraftStructurallyAligned,
} from "./tourWizardDraftSyncSelfHeal";

test("isTourWizardDraftOneVersionAhead accepts exactly +1 generation", () => {
  assert.equal(isTourWizardDraftOneVersionAhead(2, 3), true);
  assert.equal(isTourWizardDraftOneVersionAhead(2, 5), false);
  assert.equal(isTourWizardDraftOneVersionAhead(2, undefined), false);
});

test("isTourWizardDraftStructurallyAligned compares step index and payload JSON", () => {
  const payload = { basicInfo: { title: "abcdefghijklmnop" } };
  assert.equal(
    isTourWizardDraftStructurallyAligned(
      { currentStepIndex: 1, payload },
      { currentStepIndex: 1, payload: { ...payload } },
    ),
    true,
  );
  assert.equal(
    isTourWizardDraftStructurallyAligned(
      { currentStepIndex: 1, payload },
      { currentStepIndex: 2, payload },
    ),
    false,
  );
});

test("canAutoRetryTourWizardDraftSelfConflict requires aligned payload at v+1", () => {
  const payload = { basicInfo: { title: "x" } };
  assert.equal(
    canAutoRetryTourWizardDraftSelfConflict(2, {
      id: "d1",
      version: 3,
      currentStepIndex: 0,
      payload,
      updatedAt: "2026-01-01T00:00:00.000Z",
    }, { currentStepIndex: 0, payload: { ...payload } }),
    true,
  );
  assert.equal(
    canAutoRetryTourWizardDraftSelfConflict(
      2,
      {
        id: "d1",
        version: 3,
        currentStepIndex: 0,
        payload: { basicInfo: { title: "other" } },
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      { currentStepIndex: 0, payload },
    ),
    false,
  );
});
