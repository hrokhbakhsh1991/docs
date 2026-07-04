import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDenaliCatalogCard } from "../src/catalog/denali-catalog-card";
import { readDenaliCatalogDetailEgress } from "../src/catalog/read-denali-catalog-detail-egress";

describe("readDenaliCatalogDetailEgress", () => {
  const data = {
    title: "Peak trek",
    destinationId: "dest-1",
    category: "mountain_single_day",
    approximateReturnTime: "18:30",
    meetingPoint: "Parking lot A",
    program: {
      longDescription: "Full program details",
      hikingHoursApprox: 6,
      hikingGoHours: 3,
      hikingReturnHours: 3,
    },
    tripDetails: {
      overview: {
        peakHeight: 4100,
        trailDistanceKm: 12,
      },
      metrics: {
        elevationGain: 900,
      },
      logistics: {
        gatheringPoints: [
          {
            name: "Tehran terminal",
            latitude: 35.7,
            longitude: 51.4,
            isPrimary: true,
          },
        ],
        includedServices: ["Guide", "Snack"],
        excludedServices: ["Personal gear"],
      },
    },
    participants: {
      minimumAge: 18,
      maximumAge: 55,
      fitnessPrerequisiteText: "Prior hiking experience required",
      gearItems: [{ equipmentId: "boots", name: "Hiking boots", isRequired: true }],
    },
    pricing: {
      includesTourInsurance: true,
      paymentMode: "offline_receipt",
    },
    photos: [{ url: "https://cdn.example/1.jpg" }, { url: "https://cdn.example/2.jpg" }],
  };

  it("DN-DET-01 maps PR-D detail fields from canonical data", () => {
    const egress = readDenaliCatalogDetailEgress(data, {
      destinationNameById: new Map([["dest-1", "Alam-Kuh"]]),
      coverImageUrl: "https://cdn.example/1.jpg",
    });

    assert.equal(egress.destinationLabel, "Alam-Kuh");
    assert.equal(egress.longDescription, "Full program details");
    assert.equal(egress.hikingHoursApprox, 6);
    assert.equal(egress.peakHeightMeters, 4100);
    assert.equal(egress.minimumAge, 18);
    assert.equal(egress.gatheringPoint?.label.includes("Tehran terminal"), true);
    assert.equal(egress.gatheringPoint?.latitude, 35.7);
    assert.equal(egress.meetingPointText, "Parking lot A");
    assert.equal(egress.gearItems?.[0]?.name, "Hiking boots");
    assert.deepEqual(egress.includedServices, ["Guide", "Snack"]);
    assert.equal(egress.includesTourInsurance, true);
    assert.equal(egress.paymentMode, "offline_receipt");
    assert.equal(egress.photoUrls?.length, 2);
  });

  it("DN-DET-02 attaches detail egress on catalog card mapper", () => {
    const card = toDenaliCatalogCard(
      {
        id: "tour-1",
        canonical: { schemaVersion: 1, data },
      },
      { destinationNameById: new Map([["dest-1", "Alam-Kuh"]]) }
    );

    assert.equal(card.destinationLabel, "Alam-Kuh");
    assert.equal(card.peakHeightMeters, 4100);
    assert.equal(card.gearItems?.length, 1);
  });
});
