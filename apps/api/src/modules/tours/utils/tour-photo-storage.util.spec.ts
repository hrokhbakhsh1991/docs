import assert from "node:assert/strict";
import test from "node:test";

import {
  findTourPhotoInTripDetails,
  removeTourPhotoFromTripDetails,
  stripPhotoUrlsFromTripDetails,
  tourPhotoStorageKey,
  tourPhotoStoragePrefix,
} from "./tour-photo-storage.util";

const WORKSPACE = "b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3";
const TOUR = "00000000-0000-4000-8000-000000000099";
const PHOTO = "00000000-0000-4000-8000-0000000000aa";

test("tourPhotoStorageKey uses workspace/tours/{tourId}/photos/{photoId}-{filename}", () => {
  assert.equal(
    tourPhotoStorageKey(WORKSPACE, TOUR, PHOTO, "cover.webp"),
    `${WORKSPACE}/tours/${TOUR}/photos/${PHOTO}-cover.webp`,
  );
});

test("tourPhotoStoragePrefix matches all keys for a photo id", () => {
  assert.equal(
    tourPhotoStoragePrefix(WORKSPACE, TOUR, PHOTO),
    `${WORKSPACE}/tours/${TOUR}/photos/${PHOTO}-`,
  );
});

test("findTourPhotoInTripDetails locates root gallery photos", () => {
  const ref = findTourPhotoInTripDetails(
    {
      photos: [
        {
          id: PHOTO,
          filename: "hero.jpg",
          url: "https://example.test/hero.jpg",
          size: 1,
          mimeType: "image/jpeg",
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    PHOTO,
  );
  assert.equal(ref?.id, PHOTO);
  assert.equal(ref?.filename, "hero.jpg");
});

test("stripPhotoUrlsFromTripDetails removes url from root and nested galleries", () => {
  const next = stripPhotoUrlsFromTripDetails({
    photos: [
      { id: PHOTO, filename: "a.jpg", url: "https://x/a", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" },
    ],
    itinerary: {
      dayPlans: [
        {
          day: 1,
          photos: [{ id: PHOTO, filename: "day.jpg", url: "https://x/d", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" }],
        },
      ],
      segmentActivities: [
        {
          dayNumber: 1,
          photos: [{ id: PHOTO, filename: "seg.jpg", url: "https://x/s", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" }],
        },
      ],
    },
  });

  assert.deepEqual(next.photos, [
    { id: PHOTO, filename: "a.jpg", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" },
  ]);
  assert.equal("url" in (next.itinerary?.dayPlans?.[0]?.photos?.[0] ?? {}), false);
  assert.equal("url" in (next.itinerary?.segmentActivities?.[0]?.photos?.[0] ?? {}), false);
});

test("removeTourPhotoFromTripDetails strips photo id from root and nested galleries", () => {
  const next = removeTourPhotoFromTripDetails(
    {
      photos: [
        { id: PHOTO, filename: "a.jpg", url: "https://x/a", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" },
        { id: "other", filename: "b.jpg", url: "https://x/b", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" },
      ],
      itinerary: {
      dayPlans: [
        {
          day: 1,
          photos: [{ id: PHOTO, filename: "day.jpg", url: "https://x/d", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" }],
        },
      ],
        segmentActivities: [
          {
            dayNumber: 1,
            photos: [{ id: PHOTO, filename: "seg.jpg", url: "https://x/s", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" }],
          },
        ],
      },
    },
    PHOTO,
  );

  assert.deepEqual(next.photos, [
    { id: "other", filename: "b.jpg", url: "https://x/b", size: 1, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00.000Z" },
  ]);
  assert.equal(next.itinerary?.dayPlans?.[0]?.photos, undefined);
  assert.equal(next.itinerary?.segmentActivities?.[0]?.photos, undefined);
});
