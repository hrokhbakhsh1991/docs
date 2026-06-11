/**
 * Denali wizard — catalog reference sanitization (11.8 submit hardening)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { setCanonicalValue } from "../src/tours/tour-wizard-draft-path";
import {
  filterIdsToAllowedCatalog,
  readActiveThemeIds,
  readSelectableLeaderUserIds,
  resolveMainThemeFormProfileFromCatalog,
  sanitizeLeaderUserIdsOnDraft,
  sanitizeThemeIdsOnDraft,
} from "../src/wizard/denali/denali-catalog-sanitize";

describe("denali-catalog-sanitize.spec.ts", () => {
  it("WEB-11.8-CAT-01 resolves mainThemeFormProfile from first theme", () => {
    const profile = resolveMainThemeFormProfileFromCatalog(["t1", "t2"], [
      { id: "t1", formProfile: "mountain_outdoor" },
      { id: "t2", formProfile: "nature_trip" },
    ]);
    assert.equal(profile, "mountain_outdoor");
  });

  it("WEB-11.8-CAT-02 filters stale theme and leader ids on draft", () => {
    let draft = setCanonicalValue(emptyTourWizardDraft(), "program.themeIds", ["t1", "t-stale"]);
    draft = setCanonicalValue(draft, "leaderUserIds", ["u1", "u-stale"]);
    draft = sanitizeThemeIdsOnDraft(draft, ["t1"]);
    draft = sanitizeLeaderUserIdsOnDraft(draft, ["u1"]);
    assert.deepEqual(draft.data.program, { themeIds: ["t1"] });
    assert.deepEqual(draft.data.leaderUserIds, ["u1"]);
  });

  it("WEB-11.8-CAT-03 readActiveThemeIds and readSelectableLeaderUserIds", () => {
    assert.deepEqual(
      readActiveThemeIds([
        { id: "t1", isActive: true },
        { id: "t2", isActive: false },
      ]),
      ["t1"]
    );
    assert.deepEqual(
      readSelectableLeaderUserIds([
        { userId: "u1", role: "member", isSelectableLeader: true },
        { userId: "u2", role: "member", isSelectableLeader: false },
        { userId: "u3", role: "admin", isSelectableLeader: false },
      ]),
      ["u1", "u3"]
    );
    assert.deepEqual(filterIdsToAllowedCatalog(["a", "b"], ["b"]), ["b"]);
  });
});
