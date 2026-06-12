import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliTouristTripJsonLd } from "../src/catalog/build-denali-tourist-trip-jsonld";
import { toDenaliCatalogCard } from "../src/catalog/denali-catalog-card";
import {
  collectItinerarySegmentDestinationIds,
  projectDenaliCatalogItinerary,
} from "../src/catalog/project-denali-catalog-itinerary";
import { getDenaliCatalogTour } from "../src/http/catalog.service";
import type { DenaliPublicDestinationPort } from "../src/http/ports/public-destination.port";
import type { DenaliTourStorePort } from "../src/http/ports/tour-store.port";
import {
  parseDenaliItineraryDays,
  pruneItinerarySegmentDestinationIds,
} from "../src/schemas/denaliItineraryDaySchema";
import { sanitizeItineraryDestinationIdsOnDraft } from "../src/wizard/denali-wizard-catalog-sanitize";

const TOUR_ID = "00000000-0000-4000-8000-000000000210";

function canonical(extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    roots: ["basics"] as const,
    data: {
      title: "Festival Trek",
      publishStatus: "active",
      startDateTime: "2026-07-01T08:00:00.000Z",
      endDateTime: "2026-07-03T18:00:00.000Z",
      category: "mountain_multi",
      capacityMax: 12,
      program: {
        shortDescription: "Three-day mountain program",
        difficultyLevel: 6,
        itinerary: [
          {
            dayNumber: 1,
            title: "Arrival",
            summary: "Camp setup",
            segments: [
              {
                id: "s1",
                kind: "activity",
                title: "Briefing",
                startTime: "09:00",
                locationLabel: "Base camp",
                photoIds: ["p1"],
                destinationId: "dest-1",
              },
            ],
          },
        ],
      },
      participants: { fitnessLevel: "medium" },
      pricing: { basePricePerPerson: 2500000 },
      photos: [
        { id: "p1", url: "https://cdn.example/day1.jpg" },
        { url: "https://cdn.example/cover.jpg" },
      ],
      ...extra,
    },
  };
}

describe("denali-catalog-itinerary.spec.ts", () => {
  it("DN-CAT-04 projects egress-safe itinerary days without internal ids", () => {
    const projected = projectDenaliCatalogItinerary(canonical().data);
    assert.equal(projected?.length, 1);
    assert.equal(projected?.[0]?.title, "Arrival");
    assert.equal(projected?.[0]?.segments[0]?.title, "Briefing");
    assert.equal(projected?.[0]?.segments[0]?.photoUrls?.[0], "https://cdn.example/day1.jpg");
    assert.equal(
      (projected?.[0]?.segments[0] as { destinationId?: string }).destinationId,
      undefined
    );
  });

  it("DN-CAT-10 resolves segment locationLabel from destination catalog when manual label absent", () => {
    const data = canonical().data;
    const program = data.program as {
      itinerary: Array<{ segments: Array<{ locationLabel?: string }> }>;
    };
    delete program.itinerary[0]!.segments[0]!.locationLabel;
    const projected = projectDenaliCatalogItinerary(data, {
      destinationNameById: new Map([["dest-1", "Alamut Valley"]]),
    });
    assert.equal(projected?.[0]?.segments[0]?.locationLabel, "Alamut Valley");
  });

  it("DN-CAT-11 collectItinerarySegmentDestinationIds gathers unique ids", () => {
    const ids = collectItinerarySegmentDestinationIds(canonical().data);
    assert.deepEqual(ids, ["dest-1"]);
  });

  it("DN-CAT-05 toDenaliCatalogCard attaches itineraryDays difficulty fitness and structuredData", () => {
    const card = toDenaliCatalogCard({ id: TOUR_ID, canonical: canonical() });
    assert.equal(card.difficultyLevel, 6);
    assert.equal(card.fitnessLevel, "medium");
    assert.equal(card.itineraryDays?.length, 1);
    assert.equal(card.structuredData?.["@type"], "TouristTrip");
    assert.equal(card.structuredData?.name, "Festival Trek");
    const itinerary = card.structuredData?.itinerary as { itemListElement?: unknown[] } | undefined;
    assert.equal(itinerary?.itemListElement?.length, 1);
  });

  it("DN-CAT-06 buildDenaliTouristTripJsonLd includes day descriptions", () => {
    const card = toDenaliCatalogCard({ id: TOUR_ID, canonical: canonical() });
    const jsonLd = buildDenaliTouristTripJsonLd(card);
    const firstDay = (jsonLd.itinerary?.itemListElement[0]?.item as { description?: string })
      ?.description;
    assert.match(firstDay ?? "", /Briefing/);
    assert.match(firstDay ?? "", /Base camp/);
  });

  it("DN-ITIN-10 pruneItinerarySegmentDestinationIds removes stale destination refs", () => {
    const days = parseDenaliItineraryDays(canonical().data.program.itinerary);
    const pruned = pruneItinerarySegmentDestinationIds(days, new Set(["dest-1"]));
    assert.equal(pruned[0]?.segments[0]?.destinationId, "dest-1");
    const cleared = pruneItinerarySegmentDestinationIds(days, new Set());
    assert.equal(cleared[0]?.segments[0]?.destinationId, undefined);
  });

  it("DN-ITIN-11 sanitizeItineraryDestinationIdsOnDraft prunes when allowed ids provided", () => {
    const sanitized = sanitizeItineraryDestinationIdsOnDraft(
      {
        data: {
          program: canonical().data.program,
        },
      },
      ["dest-1"]
    );
    const itinerary = sanitized.data.program as { itinerary: Array<{ segments: Array<{ destinationId?: string }> }> };
    assert.equal(itinerary.itinerary[0]?.segments[0]?.destinationId, "dest-1");

    const pruned = sanitizeItineraryDestinationIdsOnDraft(
      {
        data: {
          program: canonical().data.program,
        },
      },
      []
    );
    const prunedItinerary = pruned.data.program as {
      itinerary: Array<{ segments: Array<{ destinationId?: string }> }>;
    };
    assert.equal(prunedItinerary.itinerary[0]?.segments[0]?.destinationId, undefined);
  });

  it("DN-CAT-12 getDenaliCatalogTour enriches segment locationLabel via destination port", async () => {
    const canonicalWithoutManualLabel = canonical();
    const program = canonicalWithoutManualLabel.data.program as {
      itinerary: Array<{ segments: Array<{ locationLabel?: string }> }>;
    };
    delete program.itinerary[0]!.segments[0]!.locationLabel;

    const store: DenaliTourStorePort = {
      async listPage() {
        return { items: [] };
      },
      async findFirst() {
        return {
          id: TOUR_ID,
          createdAt: new Date(0).toISOString(),
          canonical: canonicalWithoutManualLabel,
        };
      },
    };
    const destinationPort: DenaliPublicDestinationPort = {
      async getDestinationNamesByIds(_tenantId, destinationIds) {
        assert.deepEqual(destinationIds, ["dest-1"]);
        return { "dest-1": "Alamut Valley" };
      },
    };

    const card = await getDenaliCatalogTour({
      tenantId: "tenant",
      workspaceType: "denali",
      store,
      destinationPort,
      tourId: TOUR_ID,
    });
    assert.equal(card?.itineraryDays?.[0]?.segments[0]?.locationLabel, "Alamut Valley");
  });
});
