import assert from "node:assert/strict";
import test from "node:test";

import { catalogRegistry } from "./catalog-registry";
import { cloneTripDetailsWithRemap } from "./clone-trip-details-with-remap";

const THEME_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const MEDIA_ID = "c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33";
const LEADER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

test("catalogRegistry: themeId is global, mediaId is tour-instance", () => {
  assert.equal(catalogRegistry.isGlobalCatalogReference("themeId"), true);
  assert.equal(catalogRegistry.shouldRemintOnClone("themeId"), false);
  assert.equal(catalogRegistry.isTourInstanceReference("mediaId"), true);
  assert.equal(catalogRegistry.shouldRemintOnClone("mediaId"), true);
});

test("cloneTripDetailsWithRemap preserves themeId and remints mediaId", () => {
  let remintCount = 0;
  const remintUuid = () => {
    remintCount += 1;
    return `00000000-0000-4000-8000-${String(remintCount).padStart(12, "0")}`;
  };

  const result = cloneTripDetailsWithRemap(
    {
      overview: {
        tourThemeIds: [THEME_ID],
        leaderUserIds: [LEADER_ID],
      },
      photos: [
        {
          id: MEDIA_ID,
          url: "https://example.com/tour.jpg",
          filename: "tour.jpg",
          size: 200,
          mimeType: "image/jpeg",
          uploadedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    },
    { remintUuid },
  );

  assert.ok(result);
  const overview = result!.tripDetails.overview as { tourThemeIds?: string[]; leaderUserIds?: string[] };
  const photos = result!.tripDetails.photos as { id: string }[];

  assert.deepEqual(overview.tourThemeIds, [THEME_ID]);
  assert.deepEqual(overview.leaderUserIds, [LEADER_ID]);
  assert.notEqual(photos[0]!.id, MEDIA_ID);
  assert.equal(result!.photoIdRemap.get(MEDIA_ID), photos[0]!.id);
  assert.equal("url" in photos[0]!, false);
});

test("cloneTripDetailsWithRemap remints overview map pin locationInstanceId values", () => {
  const pinIds = {
    startPoint: "11111111-1111-4111-8111-111111111111",
    summitPoint: "22222222-2222-4222-8222-222222222222",
    campPoint: "33333333-3333-4333-8333-333333333333",
  };

  const result = cloneTripDetailsWithRemap({
    overview: {
      startPoint: {
        id: pinIds.startPoint,
        addressText: "Rineh",
        latitude: 35.9,
        longitude: 52.1,
      },
      summitPoint: {
        id: pinIds.summitPoint,
        addressText: "Summit",
        latitude: 35.95,
        longitude: 52.11,
      },
      campPoint: {
        id: pinIds.campPoint,
        addressText: "Camp",
        latitude: 35.92,
        longitude: 52.05,
      },
    },
  });

  assert.ok(result);
  const overview = result!.tripDetails.overview as Record<
    string,
    { id?: string; addressText?: string }
  >;

  const expectedAddresses: Record<string, string> = {
    startPoint: "Rineh",
    summitPoint: "Summit",
    campPoint: "Camp",
  };

  for (const [field, sourceId] of Object.entries(pinIds)) {
    const cloned = overview[field];
    assert.ok(cloned?.id, field);
    assert.notEqual(cloned!.id, sourceId, field);
    assert.equal(cloned!.addressText, expectedAddresses[field]);
  }
});

test("cloneTripDetailsWithRemap drops smuggled trip_details keys (safe-remint registry walk)", () => {
  const result = cloneTripDetailsWithRemap({
    __auditGhostTripDetailsKey: "must not persist",
    overview: {
      tourThemeIds: [THEME_ID],
      shortIntro: "x",
    },
    photos: [
      {
        id: MEDIA_ID,
        url: "https://example.com/tour.jpg",
        filename: "tour.jpg",
        size: 200,
        mimeType: "image/jpeg",
        uploadedAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  });

  assert.ok(result);
  assert.equal((result!.tripDetails as Record<string, unknown>).__auditGhostTripDetailsKey, undefined);
  assert.deepEqual(
    (result!.tripDetails.overview as { tourThemeIds?: string[] }).tourThemeIds,
    [THEME_ID],
  );
});

test("cloneTripDetailsWithRemap remints gatheringPointId and nested locationInstanceId", () => {
  const result = cloneTripDetailsWithRemap({
    logistics: {
      gatheringPoints: [
        {
          id: "gp-old",
          title: "Tehran",
          location: { id: "loc-old", addressText: "Tehran", latitude: 35.7, longitude: 51.4 },
        },
      ],
    },
  });

  assert.ok(result);
  const row = (result!.tripDetails.logistics as { gatheringPoints: { id: string; location: { id?: string } }[] })
    .gatheringPoints[0]!;
  assert.notEqual(row.id, "gp-old");
  assert.ok(row.location.id);
  assert.notEqual(row.location.id, "loc-old");
});
