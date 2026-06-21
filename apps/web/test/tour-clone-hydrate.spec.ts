/**
 * Phase 11.6 — tour clone hydration (extends WEB-9.3-04)
 * Authority: docs/phase-11/tour-clone-hydration.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OPERATOR_WIZARD_PATH } from "../src/admin/require-operator-session";
import type { OperatorTourDetailResponse } from "../src/features/tours/operator-tour-detail-types";
import {
  buildCloneTourDetailUrl,
  hydrateCreateTourFromClone,
  hydrateTourCloneDraft,
  loadTourCloneHydrator,
  readActiveDestinationIds,
  readActiveEquipmentIds,
  resolveCloneTourId,
  shouldHydrateDraftFromRemote,
  shouldSkipWizardTemplatePrefill,
} from "../src/tours/tour-clone-hydrate-logic";
import { getCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";

async function hydrateDenaliTourCloneDraft(
  detail: OperatorTourDetailResponse,
  options?: Parameters<typeof hydrateTourCloneDraft>[2]
) {
  const hydrator = await loadTourCloneHydrator("denali");
  if (hydrator == null) {
    throw new Error("DENALI_TOUR_CLONE_HYDRATOR_MISSING");
  }
  return hydrateTourCloneDraft(hydrator, detail, options).draft;
}

function sampleDetail(title: string): OperatorTourDetailResponse {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    tenantId: "00000000-0000-4000-8000-000000000014",
    rowVersion: 1,
    canonical: {
      data: {
        title,
        program: { shortDescription: "Day hike" },
        participants: {
          gearItems: [{ equipmentId: "eq-1", name: "Crampons", isRequired: true }],
        },
      },
    },
    projection: {
      id: "00000000-0000-4000-8000-000000000099",
      tenantId: "00000000-0000-4000-8000-000000000014",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      rowVersion: 1,
      title,
      shortDescription: "Day hike",
      listStatus: "draft",
      uiStatus: "draft",
      priceAmount: null,
      priceCurrency: null,
      totalCapacity: null,
      acceptedCount: 0,
      category: null,
      coverImageUrl: null,
      departureAt: null,
    },
  };
}

describe("tour-clone-hydrate.spec.ts — Phase 11.6 Web", () => {
  it("WEB-9.3-04 duplicate URL + hydrate applies Copy suffix (CP-9.3-L09)", async () => {
    const tourId = "00000000-0000-4000-8000-000000000099";
    const cloneUrl = `${OPERATOR_WIZARD_PATH}?clone=${encodeURIComponent(tourId)}`;
    assert.equal(cloneUrl, `/tours/new?clone=${tourId}`);
    assert.equal(resolveCloneTourId(tourId), tourId);
    assert.equal(buildCloneTourDetailUrl(tourId), `/api/tours/${tourId}`);

    const draft = await hydrateDenaliTourCloneDraft(sampleDetail("Source tour"), {
      activeEquipmentIds: ["eq-1"],
    });
    assert.equal(getCanonicalStringValue(draft, "title"), "Source tour (Copy)");
    const gear = draft.data.participants as { gearItems: unknown[] };
    assert.equal(gear.gearItems.length, 1);
  });

  it("WEB-P11-6-05 readActiveEquipmentIds skips inactive rows", () => {
    const ids = readActiveEquipmentIds([
      { id: "eq-1", isActive: true },
      { id: "eq-2", isActive: false },
    ]);
    assert.deepEqual(ids, ["eq-1"]);
  });

  it("P15-W-B1b readActiveDestinationIds skips inactive rows", () => {
    const ids = readActiveDestinationIds([
      { id: "dest-1", isActive: true },
      { id: "dest-2", isActive: false },
    ]);
    assert.deepEqual(ids, ["dest-1"]);
  });

  it("P15-W-B1b hydrateCreateTourFromClone fetches tour + catalogs", async () => {
    const tourId = "00000000-0000-4000-8000-000000000099";
    const detail = sampleDetail("Clone source");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes(`/api/tours/${tourId}`)) {
        return new Response(JSON.stringify(detail), { status: 200 });
      }
      if (url.includes("/api/settings/resources/equipment")) {
        return new Response(JSON.stringify({ items: [{ id: "eq-1", isActive: true }] }), {
          status: 200,
        });
      }
      if (url.includes("/api/settings/resources/locations")) {
        return new Response(
          JSON.stringify({
            destinations: [{ id: "dest-1", name: "Base", isActive: true }],
          }),
          { status: 200 }
        );
      }
      return new Response("not found", { status: 404 });
    };
    try {
      const result = await hydrateCreateTourFromClone({
        cloneTourId: tourId,
        pluginId: "denali",
        wizardSessionId: "11111111-1111-4111-8111-111111111111",
      });
      assert.equal(getCanonicalStringValue(result.draft, "title"), "Clone source (Copy)");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("WEB-P11-6-06 starter ignores clone query for prefill and remote hydrate", async () => {
    const tourId = "00000000-0000-4000-8000-000000000099";
    assert.equal(shouldSkipWizardTemplatePrefill(tourId, false), false);
    assert.equal(shouldHydrateDraftFromRemote(tourId, false), true);
    assert.equal(await loadTourCloneHydrator("starter"), null);
  });

  it("WEB-P11-6-07 omitting equipment ids preserves source gear", async () => {
    const draft = await hydrateDenaliTourCloneDraft(sampleDetail("Gear tour"));
    const gear = draft.data.participants as { gearItems: unknown[] };
    assert.equal(gear.gearItems.length, 1);
  });

  it("WEB-P11-6-08 empty equipment catalog strips all gear rows", async () => {
    const draft = await hydrateDenaliTourCloneDraft(sampleDetail("Gear tour"), {
      activeEquipmentIds: [],
    });
    const gear = draft.data.participants as { gearItems: unknown[] };
    assert.equal(gear.gearItems.length, 0);
  });

  it("WEB-P11-13-01 wizardSessionId remints storage-backed photos", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000014";
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const sourceKey = `${tenantId}/tours/tour-src/photos/photo-old`;
    const detail = sampleDetail("Photo tour");
    detail.canonical.data.photos = [
      { id: "photo-old", storageKey: sourceKey, contentType: "image/png" },
    ];

    const hydrator = await loadTourCloneHydrator("denali");
    assert.ok(hydrator);
    const result = hydrateTourCloneDraft(hydrator, detail, {
      wizardSessionId: sessionId,
      tenantId,
    });
    assert.ok(result);
    const photos = result!.draft.data.photos as Array<{ id: string; storageKey: string }>;
    assert.notEqual(photos[0]!.id, "photo-old");
    assert.match(photos[0]!.storageKey, /wizard-drafts/);
    assert.equal(result!.photoRemintPlan?.length, 1);
  });
});
