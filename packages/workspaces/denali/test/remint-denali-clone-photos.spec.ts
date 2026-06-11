/**
 * Phase 11.13 — clone photo remint (DEC-P11-011)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { remintDenaliClonePhotosInCanonical } from "../src/clone/remint-denali-clone-photos";

const TENANT_ID = "00000000-0000-4000-8000-000000000014";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_TOUR_ID = "22222222-2222-4222-8222-222222222222";
const NEW_TOUR_ID = "33333333-3333-4333-8333-333333333333";

describe("remint-denali-clone-photos.spec.ts — Phase 11.13", () => {
  it("DENALI-P11-13-01 remints ids and wizard-draft storage keys", () => {
    const sourceKey = `${TENANT_ID}/tours/${SOURCE_TOUR_ID}/photos/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
    const { data, plan } = remintDenaliClonePhotosInCanonical(
      {
        photos: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            storageKey: sourceKey,
            contentType: "image/jpeg",
          },
        ],
      },
      { kind: "wizard-draft", tenantId: TENANT_ID, sessionId: SESSION_ID }
    );

    const photos = data.photos as Array<{ id: string; storageKey: string }>;
    assert.equal(photos.length, 1);
    assert.notEqual(photos[0]!.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.match(photos[0]!.storageKey, new RegExp(`^${TENANT_ID}/wizard-drafts/${SESSION_ID}/photos/`));
    assert.equal(plan.length, 1);
    assert.equal(plan[0]!.sourceStorageKey, sourceKey);
    assert.equal(plan[0]!.destStorageKey, photos[0]!.storageKey);
  });

  it("DENALI-P11-13-02 https url rows keep url and skip remint plan", () => {
    const { data, plan } = remintDenaliClonePhotosInCanonical(
      {
        photos: [
          {
            id: "photo-url-1",
            url: "https://cdn.example.com/cover.jpg",
          },
        ],
      },
      { kind: "wizard-draft", tenantId: TENANT_ID, sessionId: SESSION_ID }
    );

    const photos = data.photos as Array<{ id: string; url: string; storageKey?: string }>;
    assert.equal(photos[0]!.url, "https://cdn.example.com/cover.jpg");
    assert.equal(photos[0]!.storageKey, undefined);
    assert.equal(plan.length, 0);
    assert.notEqual(photos[0]!.id, "photo-url-1");
  });

  it("DENALI-P11-13-03 tour remint uses new tour id in storage key", () => {
    const sourceKey = `${TENANT_ID}/tours/${SOURCE_TOUR_ID}/photos/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`;
    const { data, plan } = remintDenaliClonePhotosInCanonical(
      {
        photos: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", storageKey: sourceKey }],
      },
      { kind: "tour", tenantId: TENANT_ID, tourId: NEW_TOUR_ID }
    );

    const photos = data.photos as Array<{ storageKey: string }>;
    assert.match(photos[0]!.storageKey, new RegExp(`^${TENANT_ID}/tours/${NEW_TOUR_ID}/photos/`));
    assert.equal(plan[0]!.destStorageKey, photos[0]!.storageKey);
  });
});
