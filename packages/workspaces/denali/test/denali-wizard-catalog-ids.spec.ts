import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateDenaliSubmitCatalogIds,
  DENALI_SUBMIT_CATALOG_BFF_PATHS,
  isWizardLeaderCandidate,
  readActiveDestinationIds,
  readActiveGuideLanguageIds,
  readActiveThemeIds,
  readSelectableLeaderUserIds,
  resolveMainThemeFormProfileFromCatalog,
} from "../src/wizard/denali-wizard-catalog-sanitize";

describe("denali-wizard-catalog-ids.spec.ts (P15-W-C1)", () => {
  it("readActiveGuideLanguageIds drops inactive and blank ids", () => {
    assert.deepEqual(
      readActiveGuideLanguageIds([
        { id: " gl-1 ", isActive: true },
        { id: "gl-2", isActive: false },
        { id: "", isActive: true },
      ]),
      ["gl-1"]
    );
  });

  it("readActiveDestinationIds keeps active destination ids", () => {
    assert.deepEqual(
      readActiveDestinationIds([
        { id: "d1", isActive: true },
        { id: "d2", isActive: false },
      ]),
      ["d1"]
    );
  });

  it("isWizardLeaderCandidate accepts admin, owner, selectable, reward labels", () => {
    assert.equal(isWizardLeaderCandidate({ userId: "u1", role: "admin" }), true);
    assert.equal(isWizardLeaderCandidate({ userId: "u2", role: "owner" }), true);
    assert.equal(
      isWizardLeaderCandidate({ userId: "u3", role: "member", isSelectableLeader: true }),
      true
    );
    assert.equal(
      isWizardLeaderCandidate({ userId: "u4", role: "member", labels: ["راهنما"] }),
      true
    );
    assert.equal(isWizardLeaderCandidate({ userId: "u5", role: "member" }), false);
  });

  it("readSelectableLeaderUserIds filters leader candidates", () => {
    assert.deepEqual(
      readSelectableLeaderUserIds([
        { userId: "u1", role: "member", isSelectableLeader: true },
        { userId: "u2", role: "member", isSelectableLeader: false },
        { userId: "u3", role: "admin", isSelectableLeader: false },
      ]),
      ["u1", "u3"]
    );
  });

  it("resolveMainThemeFormProfileFromCatalog reads first theme profile", () => {
    assert.equal(
      resolveMainThemeFormProfileFromCatalog(["t1", "t2"], [
        { id: "t1", formProfile: "mountain_outdoor" },
        { id: "t2", formProfile: "nature_trip" },
      ]),
      "mountain_outdoor"
    );
  });

  it("aggregateDenaliSubmitCatalogIds builds partial catalog from resource rows", () => {
    assert.deepEqual(
      aggregateDenaliSubmitCatalogIds({
        equipmentItems: [{ id: "eq-1", isActive: true }],
        themeItems: [
          { id: "t1", isActive: true },
          { id: "t2", isActive: false },
        ],
        userItems: [{ userId: "u1", role: "admin" }],
      }),
      {
        activeEquipmentIds: ["eq-1"],
        activeThemeIds: ["t1"],
        selectableLeaderIds: ["u1"],
      }
    );
  });

  it("DENALI_SUBMIT_CATALOG_BFF_PATHS exposes operator catalog fetch routes", () => {
    assert.equal(DENALI_SUBMIT_CATALOG_BFF_PATHS.equipment, "/api/settings/resources/equipment");
    assert.match(DENALI_SUBMIT_CATALOG_BFF_PATHS.activeUsers, /role=all/);
  });

  it("readActiveThemeIds alias matches readActiveCatalogIds", () => {
    assert.deepEqual(readActiveThemeIds([{ id: "t1", isActive: true }]), ["t1"]);
  });
});
