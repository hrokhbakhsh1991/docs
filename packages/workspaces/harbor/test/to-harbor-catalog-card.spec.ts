import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CanonicalDocument, PublicCatalogTourInput } from "@app-tour/workspace-sdk";

import {
  isHarborTourPublished,
  toHarborCatalogCard,
} from "../src/catalog/to-harbor-catalog-card";
import {
  configureHarborHttpHost,
  resetHarborHttpHostForTests,
  tryGetHarborHttpHost,
} from "../src/http/host-runtime";

function tourInput(
  data: Record<string, unknown>,
  id = "tour-harbor-1",
): PublicCatalogTourInput {
  return {
    id,
    canonical: {
      schemaVersion: 1,
      roots: [],
      data,
    } as CanonicalDocument,
    catalogUpdatedAt: "2026-08-01T00:00:00.000Z",
  };
}

describe("PSR-6c2 toHarborCatalogCard", () => {
  it("maps flat smoke-like canonical fields + city", () => {
    const card = toHarborCatalogCard(
      tourInput({
        title: "Evening sail",
        shortDescription: "Waterfront",
        category: "city_sail",
        city: "bandar",
        departureAt: "2026-09-12T17:00:00.000Z",
        endAt: "2026-09-12T21:00:00.000Z",
        priceAmount: 1000,
        priceCurrency: "IRR",
        totalCapacity: 12,
        publishStatus: "published",
        policiesText: "Free cancel 24h",
        cancellationDeadlineHours: 24,
        cancellationPenaltyPercentage: 50,
      }),
    );
    assert.equal(card.id, "tour-harbor-1");
    assert.equal(card.title, "Evening sail");
    assert.equal(card.city, "bandar");
    assert.equal(card.listSubtitle, "bandar");
    assert.equal(card.priceAmount, 1000);
    assert.equal(card.structuredData?.["@type"], "Event");
  });

  it("reads nested data.tour city (Urban-like)", () => {
    const card = toHarborCatalogCard(
      tourInput({
        tour: {
          title: "Nested sail",
          city: "bushehr",
          catalogSummary: "South coast",
          startDate: "2026-10-01T10:00:00.000Z",
          status: "published",
        },
      }),
    );
    assert.equal(card.title, "Nested sail");
    assert.equal(card.city, "bushehr");
    assert.equal(card.shortDescription, "South coast");
    assert.equal(card.departureAt, "2026-10-01T10:00:00.000Z");
  });

  it("isHarborTourPublished honors publishStatus/status", () => {
    assert.equal(
      isHarborTourPublished(
        tourInput({ publishStatus: "published" }).canonical,
      ),
      true,
    );
    assert.equal(
      isHarborTourPublished(tourInput({ status: "draft" }).canonical),
      false,
    );
  });
});

describe("PSR-6c2 harbor HTTP host slot", () => {
  it("tryGet is null until configure", () => {
    resetHarborHttpHostForTests();
    assert.equal(tryGetHarborHttpHost(), null);
    configureHarborHttpHost({
      runWithHttpRequestContext: async (_req, _auth, fn) => fn(),
      sendJson: () => undefined,
      sendHttpError: () => undefined,
      handleHttpError: () => undefined,
      resolveWorkspaceTypeForTenant: async () => "harbor",
      resolveTourStore: async () => ({
        listPage: async () => ({ items: [] }),
        findFirst: async () => null,
      }),
      resolvePublicBookingPort: () => ({
        findDuplicateByTourGuest: async () => null,
        findDuplicateByTourGuestLabel: async () => null,
        findDuplicateByTourGuestNationalId: async () => null,
        findDuplicateByTourEmail: async () => null,
        createPendingBooking: async () => ({ id: "x", status: "pending" }),
        sumApprovedPartySizeByTourIds: async () => ({}),
      }),
      readHarborRegistrationRequestBody: async () => ({}),
    });
    assert.ok(tryGetHarborHttpHost());
    resetHarborHttpHostForTests();
    assert.equal(tryGetHarborHttpHost(), null);
  });
});
