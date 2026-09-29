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
      new Set(["title", "denali.datetime"])
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
      new Set(["title", "denali.pricing-participants"])
    );
    const offers = (redacted.structuredData as { offers?: unknown } | undefined)?.offers;
    assert.equal(offers, undefined);
  });

  it("BUG-STG-019 redacts detail-only participant, payment, location, and derived capacity fields", () => {
    const card = toDenaliCatalogCard({
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
          approximateReturnTime: "18:30",
          participants: {
            minimumAge: 18,
            maximumAge: 55,
            fitnessLevel: "high",
            fitnessPrerequisiteText: "Regular hiking",
          },
          pricing: {
            basePricePerPerson: 1000,
            paymentMode: "offline_receipt",
            paymentCollection: "offline",
            registrationApproval: "manual",
            includesTourInsurance: true,
          },
          transport: {
            mode: "bus",
            transportCost: 250,
            dongAmount: 75,
          },
        },
      },
    });
    const redacted = applyDenaliCatalogCardExposure(card, new Set(["title"]));

    assert.equal(redacted.priceAmount, null);
    assert.equal(redacted.minimumAge, null);
    assert.equal(redacted.maximumAge, null);
    assert.equal(redacted.fitnessLevel, null);
    assert.equal(redacted.fitnessPrerequisiteText, null);
    assert.equal(redacted.paymentMode, null);
    assert.equal("paymentPlan" in redacted, false);
    assert.equal("paymentCollection" in redacted, false);
    assert.equal("registrationApproval" in redacted, false);
    assert.equal("includesTourInsurance" in redacted, false);
    assert.equal(redacted.totalCapacity, null);
    assert.equal(redacted.spotsRemaining, null);
    assert.equal(redacted.gatheringPoint, null);
    assert.equal("transport" in redacted, false);
  });

  it("BUG-STG-025 keeps only the safe free marker when payment policy is hidden", () => {
    const card = toDenaliCatalogCard({
      id: "free-tour",
      canonical: {
        schemaVersion: 1,
        data: {
          title: "Free tour",
          pricingPayment: { requiresPayment: false },
        },
      },
    });
    const redacted = applyDenaliCatalogCardExposure(card, new Set(["title"]));

    assert.equal(redacted.paymentCollection, "free");
    assert.equal(redacted.paymentMode, null);
    assert.equal("registrationApproval" in redacted, false);
  });

  it("BUG-STG-019 hides base/member pricing when payment policy is not exposed", () => {
    const card = toDenaliCatalogCard({
      id: "paid-tour",
      canonical: {
        schemaVersion: 1,
        data: {
          title: "Paid tour",
          pricing: {
            basePricePerPerson: 2_000_000,
            paymentMode: "offline_receipt",
            paymentCollection: "offline",
            registrationApproval: "manual",
          },
        },
      },
    });
    const redacted = applyDenaliCatalogCardExposure(
      card,
      new Set(["title", "denali.pricing-participants"])
    );

    assert.equal(redacted.priceAmount, null);
    assert.equal(redacted.paymentMode, null);
    assert.equal("paymentCollection" in redacted, false);
    assert.equal("registrationApproval" in redacted, false);
  });

  it("BUG-STG-019 removes transport money while preserving an independently exposed mode", () => {
    const card = toDenaliCatalogCard({
      id: "mixed-exposure-tour",
      canonical: {
        schemaVersion: 1,
        data: {
          title: "Mixed exposure tour",
          pricing: {
            basePricePerPerson: 2_000_000,
            paymentMode: "offline_receipt",
            paymentCollection: "offline",
          },
          transport: {
            mode: "shared_cars",
            dongAmount: 300_000,
          },
        },
      },
    });

    const redacted = applyDenaliCatalogCardExposure(
      card,
      new Set(["title", "denali.transport-mode"])
    );

    assert.equal(redacted.transport?.mode, "shared_cars");
    assert.equal(redacted.transport?.dongAmount, undefined);
    assert.equal(redacted.transport?.transportCostAmount, undefined);
    assert.equal(redacted.priceAmount, null);
  });

  it("BUG-STG-006 makes transport visibility depend on the Exposure field", () => {
    const card = toDenaliCatalogCard({
      id: "tour-transport",
      canonical: {
        schemaVersion: 1,
        data: {
          title: "Transport tour",
          publishStatus: "active",
          startDateTime: "2026-07-01T08:00:00.000Z",
          transport: { mode: "bus", transportCost: 250_000 },
        },
      },
    });

    const visible = applyDenaliCatalogCardExposure(
      card,
      new Set(["title", "denali.transport-mode"])
    );
    const hidden = applyDenaliCatalogCardExposure(card, new Set(["title"]));

    assert.equal(visible.transport?.mode, "bus");
    assert.equal("transport" in hidden, false);
  });

  it("BUG-STG-036 removes the canonical destination slug from every public card surface", () => {
    const card = toDenaliCatalogCard({
      id: "tour-destination-redaction",
      canonical: {
        schemaVersion: 1,
        data: {
          title: "Alpine trek",
          category: "mountain_multi",
          destinationId: "destination-1",
          program: { shortDescription: "A public summary" },
        },
      },
    });

    const redacted = applyDenaliCatalogCardExposure(card, new Set(["title"]));
    assert.equal(redacted.category, null);
    assert.equal(redacted.listSubtitle, null);
    assert.equal(redacted.destinationLabel, null);
    assert.equal(JSON.stringify(redacted).includes("mountain_multi"), false);
  });

  it("excludes no-op and delivery-only fields from catalog bindings", () => {
    const bindingFieldIds = DENALI_CATALOG_CARD_EXPOSURE_BINDINGS.map((entry) => entry.fieldId);
    assert.ok(bindingFieldIds.includes("denali.pricing-payment"));
    assert.ok(bindingFieldIds.includes("denali.transport-mode"));
    assert.ok(bindingFieldIds.includes("denali.approximate-return-time"));
    assert.ok(bindingFieldIds.includes("denali.location-zones"));
    assert.ok(!bindingFieldIds.includes("capacityMin"));
  });
});
