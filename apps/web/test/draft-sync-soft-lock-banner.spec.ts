import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldShowCreateTourWizardSoftLockBanner } from "../src/draft/draft-sync-soft-lock-banner";

describe("draft-sync-soft-lock-banner.spec.ts", () => {
  it("WEB-P11-SOFT-01 create-tour wizard shows soft-lock banner only on ERROR", () => {
    assert.equal(shouldShowCreateTourWizardSoftLockBanner("ERROR"), true);
    assert.equal(shouldShowCreateTourWizardSoftLockBanner("SYNCING"), false);
    assert.equal(shouldShowCreateTourWizardSoftLockBanner("CONFLICT_RESOLVING"), false);
    assert.equal(shouldShowCreateTourWizardSoftLockBanner("DIRTY"), false);
    assert.equal(shouldShowCreateTourWizardSoftLockBanner("IDLE"), false);
  });
});
