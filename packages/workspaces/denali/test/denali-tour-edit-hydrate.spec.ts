import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliHydrateTourCloneDraft, denaliHydrateTourEditDraft } from "@app-tour/workspace-denali/clone/hydration";

describe("denali tour edit hydrate — Phase 12.2b", () => {
  it("DEN-12.2b-01 edit hydrate preserves title (no copy suffix)", () => {
    const canonical = {
      title: "Alpine trek",
      category: "mountain",
      publishStatus: "published",
    };
    const clone = denaliHydrateTourCloneDraft(canonical);
    const edit = denaliHydrateTourEditDraft(canonical);
    assert.match(String(clone.data.title), /\(Copy\)$/);
    assert.equal(edit.data.title, "Alpine trek");
    assert.equal(edit.data.publishStatus, "published");
  });

  it("DEN-12.2b-02 hydrate prunes stale itinerary destination ids", () => {
    const canonical = {
      title: "Multi-day trek",
      category: "mountain_multi",
      program: {
        itinerary: [
          {
            dayNumber: 1,
            title: "Day one",
            segments: [
              { id: "s1", kind: "activity", title: "Hike", destinationId: "dest-stale" },
              { id: "s2", kind: "activity", title: "Camp", destinationId: "dest-ok" },
            ],
          },
        ],
      },
    };
    const edit = denaliHydrateTourEditDraft(canonical, {
      activeDestinationIds: ["dest-ok"],
    });
    const itinerary = edit.data.program as {
      itinerary: Array<{ segments: Array<{ destinationId?: string }> }>;
    };
    assert.equal(itinerary.itinerary[0]?.segments[0]?.destinationId, undefined);
    assert.equal(itinerary.itinerary[0]?.segments[1]?.destinationId, "dest-ok");
  });

  it("DEN-12.2b-03 edit hydrate prunes orphan itinerary segment photoIds", () => {
    const canonical = {
      title: "Photo trek",
      category: "mountain_multi",
      photos: [{ id: "p1", label: "Summit" }],
      program: {
        itinerary: [
          {
            dayNumber: 1,
            title: "Day one",
            segments: [
              { id: "s1", kind: "activity", title: "Hike", photoIds: ["p1", "p-stale"] },
            ],
          },
        ],
      },
    };
    const edit = denaliHydrateTourEditDraft(canonical);
    const itinerary = edit.data.program as {
      itinerary: Array<{ segments: Array<{ photoIds?: string[] }> }>;
    };
    assert.deepEqual(itinerary.itinerary[0]?.segments[0]?.photoIds, ["p1"]);
  });

  it("DEN-12.2b-04 clone remint rewires segment photoIds to new photo ids", () => {
    const canonical = {
      title: "Clone trek",
      category: "mountain_multi",
      photos: [
        {
          id: "old-photo",
          storageKey: "tenant/tours/source/photos/old-photo",
          contentType: "image/jpeg",
        },
      ],
      program: {
        itinerary: [
          {
            dayNumber: 1,
            title: "Day one",
            segments: [
              { id: "s1", kind: "activity", title: "Hike", photoIds: ["old-photo"] },
            ],
          },
        ],
      },
    };
    const clone = denaliHydrateTourCloneDraft(canonical, {
      wizardSessionId: "00000000-0000-4000-8000-000000000301",
      tenantId: "00000000-0000-4000-8000-000000000014",
    });
    const photos = clone.data.photos as Array<{ id: string }>;
    const itinerary = clone.data.program as {
      itinerary: Array<{ segments: Array<{ photoIds?: string[] }> }>;
    };
    assert.equal(photos.length, 1);
    assert.notEqual(photos[0]?.id, "old-photo");
    assert.deepEqual(itinerary.itinerary[0]?.segments[0]?.photoIds, [photos[0]?.id]);
    assert.equal(clone.photoRemintPlan?.length, 1);
  });
});
