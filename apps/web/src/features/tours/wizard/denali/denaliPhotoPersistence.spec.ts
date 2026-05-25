import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  collectDenaliUnpersistedPhotoBlobIssues,
  formatDenaliPhotoPersistenceWarning,
  hasDenaliUnpersistedPhotoBlobs,
} from "./denaliPhotoPersistence";

test("collectDenaliUnpersistedPhotoBlobIssues detects gallery blob URLs", () => {
  const form = buildDenaliTourCreateTestValues();
  form.photosData.photos = [
    {
      id: "p1",
      url: "blob:http://localhost/abc",
      filename: "a.jpg",
      size: 1,
      mimeType: "image/jpeg",
      uploadedAt: new Date().toISOString(),
    },
  ];
  assert.equal(hasDenaliUnpersistedPhotoBlobs(form), true);
  const issues = collectDenaliUnpersistedPhotoBlobIssues(form);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, "gallery");
  const message = formatDenaliPhotoPersistenceWarning(issues);
  assert.match(message, /blob/);
});

test("https gallery URLs pass persistence check", () => {
  const form = buildDenaliTourCreateTestValues();
  form.photosData.photos = [
    {
      id: "p1",
      url: "https://cdn.example/photo.jpg",
      filename: "a.jpg",
      size: 1,
      mimeType: "image/jpeg",
      uploadedAt: new Date().toISOString(),
    },
  ];
  assert.equal(hasDenaliUnpersistedPhotoBlobs(form), false);
});
