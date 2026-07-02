import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

import {
  applyDenaliCatalogCardExposure,
  DENALI_CATALOG_CARD_EXPOSURE_BINDINGS,
} from "../src/catalog/denali-catalog-exposure-bindings";
import { toDenaliCatalogCard } from "../src/catalog/denali-catalog-card";

describe("applyDenaliCatalogCardExposure", () => {
  const tour = {
    id: "tour-1",
    canonical: {
      schemaVersion: 1,
      data: {
        title: "Alpine trek",
        publishStatus: "active",
        startDateTime: "2026-07-01T08:00:00.000Z",
        endDateTime: "2026-07-01T18:00:00.000Z",
        capacityMax: 12,
        meetingPoint: "Base camp",
      },
    },
  };

  it("redacts hidden fields from catalog cards", () => {
    const card = toDenaliCatalogCard(tour);
    const redacted = applyDenaliCatalogCardExposure(
      card,
      new Set(["title", "denali.datetime"]),
    ) as PublicCatalogCard;

    assert.equal(redacted.title, "Alpine trek");
    assert.equal(redacted.departureAt, "2026-07-01T08:00:00.000Z");
    assert.equal(redacted.endAt, null);
    assert.equal(redacted.totalCapacity, null);
  });

  it("removes structured data when title is hidden", () => {
    const card = toDenaliCatalogCard(tour);
    const redacted = applyDenaliCatalogCardExposure(card, new Set(["denali.datetime"]));
    assert.equal("structuredData" in redacted, false);
  });

  it("rebuilds structured data without offers when price is hidden", () => {
    const card = toDenaliCatalogCard(tour);
    const redacted = applyDenaliCatalogCardExposure(
      card,
      new Set(["title", "denali.pricing-participants"]),
    );
    const offers = (redacted.structuredData as { offers?: unknown } | undefined)?.offers;
    assert.equal(offers, undefined);
  });

  it("excludes delivery-only fields from catalog card bindings", () => {
    const bindingFieldIds = DENALI_CATALOG_CARD_EXPOSURE_BINDINGS.map((entry) => entry.fieldId);
    assert.ok(!bindingFieldIds.includes("denali.approximate-return-time"));
    assert.ok(!bindingFieldIds.includes("denali.location-zones"));
    assert.ok(!bindingFieldIds.includes("capacityMin"));
    assert.ok(!bindingFieldIds.includes("denali.pricing-payment"));
  });
});
