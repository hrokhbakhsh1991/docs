import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readDenaliCanonicalPhotoRows,
  readDenaliFirstPhotoHttpsUrl,
  readDenaliFirstPhotoStorageKey,
} from "../src/list/read-denali-first-photo";

describe("read-denali-first-photo", () => {
  it("DN-COVER-01 prefers first array photo storageKey", () => {
    const photos = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        storageKey: "tenant/wizard-drafts/session/photos/p1",
      },
    ];
    assert.equal(readDenaliFirstPhotoStorageKey(photos), "tenant/wizard-drafts/session/photos/p1");
    assert.equal(readDenaliFirstPhotoHttpsUrl(photos), null);
  });

  it("DN-COVER-02 accepts https url on first photo", () => {
    const photos = [{ id: "p1", url: "https://cdn.example.com/cover.jpg" }];
    assert.equal(readDenaliFirstPhotoHttpsUrl(photos), "https://cdn.example.com/cover.jpg");
    assert.equal(readDenaliFirstPhotoStorageKey(photos), null);
  });

  it("DN-COVER-03 rejects non-https url", () => {
    const photos = [{ id: "p1", url: "http://cdn.example.com/cover.jpg" }];
    assert.equal(readDenaliFirstPhotoHttpsUrl(photos), null);
  });

  it("DN-COVER-04 resolves legacy photosData.photos rows", () => {
    const rows = readDenaliCanonicalPhotoRows({
      basicInfo: { title: "Legacy tour" },
      photosData: {
        photos: [
          {
            id: "p1",
            storageKey: "tenant/tours/tour-id/photos/p1",
          },
        ],
      },
    });
    assert.equal(rows.length, 1);
    assert.equal(readDenaliFirstPhotoStorageKey(rows), "tenant/tours/tour-id/photos/p1");
  });
});
