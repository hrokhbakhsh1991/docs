/**
 * Denali wizard — catalog reference sanitization (11.8 submit hardening)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { setCanonicalValue } from "../src/tours/tour-wizard-draft-path";
import {
  filterIdsToAllowedCatalog,
  readActiveDestinationIds,
  readActiveThemeIds,
  readSelectableLeaderUserIds,
  resolveMainThemeFormProfileFromCatalog,
  sanitizeLeaderUserIdsOnDraft,
  sanitizeThemeIdsOnDraft,
} from "@app-tour/workspace-denali/host/wizard/catalog-sanitize";
import { loadDenaliSubmitCatalogIds } from "@app-tour/workspace-denali/host/ui/adapters/submit-catalog-fetch";

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
        { userId: "u4", role: "member", isSelectableLeader: false, labels: ["admin"] },
        { userId: "u5", role: "member", isSelectableLeader: false, labels: ["راهنما"] },
      ]),
      ["u1", "u3", "u4", "u5"]
    );
    assert.deepEqual(filterIdsToAllowedCatalog(["a", "b"], ["b"]), ["b"]);
  });

  it("WEB-11.8-CAT-04 readActiveDestinationIds skips inactive rows", () => {
    assert.deepEqual(
      readActiveDestinationIds([
        { id: "d1", regionId: "r1", name: "Alamut", isActive: true },
        { id: "d2", regionId: "r1", name: "Inactive", isActive: false },
      ]),
      ["d1"]
    );
  });

  it("P15-W-B1d loadDenaliSubmitCatalogIds aggregates active catalog ids", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/settings/resources/equipment")) {
        return new Response(JSON.stringify({ items: [{ id: "eq-1", isActive: true }] }), {
          status: 200,
        });
      }
      if (url.includes("/api/settings/resources/tour_themes")) {
        return new Response(JSON.stringify({ items: [{ id: "t1", isActive: true }] }), {
          status: 200,
        });
      }
      if (url.includes("/api/settings/resources/guide_languages")) {
        return new Response(JSON.stringify({ items: [{ id: "gl-1", isActive: true }] }), {
          status: 200,
        });
      }
      if (url.includes("/api/settings/resources/locations")) {
        return new Response(
          JSON.stringify({
            destinations: [{ id: "d1", regionId: "r1", name: "Alamut", isActive: true }],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/api/users")) {
        return new Response(
          JSON.stringify({
            items: [{ userId: "u1", role: "admin", isSelectableLeader: false }],
          }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    };
    try {
      const catalog = await loadDenaliSubmitCatalogIds();
      assert.deepEqual(catalog.activeEquipmentIds, ["eq-1"]);
      assert.deepEqual(catalog.activeThemeIds, ["t1"]);
      assert.deepEqual(catalog.activeGuideLanguageIds, ["gl-1"]);
      assert.deepEqual(catalog.activeDestinationIds, ["d1"]);
      assert.deepEqual(catalog.selectableLeaderIds, ["u1"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
