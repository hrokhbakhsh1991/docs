import assert from "node:assert/strict";
import { test } from "node:test";

import {
  beginDenaliExistingTourSave,
  beginDenaliPhotoUpload,
  denaliPhotoUploadPending,
  subscribeDenaliPhotoUploadPending,
} from "../src/ui/adapters/photo-edit-activity";

test("save and photo upload mutually exclude only within one wizard session", () => {
  const session = "wizard-edit-A";
  const seen: boolean[] = [];
  const unsubscribe = subscribeDenaliPhotoUploadPending(session, () => {
    seen.push(denaliPhotoUploadPending(session));
  });
  const photoOne = beginDenaliPhotoUpload(session);
  const photoTwo = beginDenaliPhotoUpload(session);
  assert.ok(photoOne && photoTwo);
  assert.equal(denaliPhotoUploadPending(session), true);
  assert.equal(beginDenaliExistingTourSave(session), null);

  const otherSave = beginDenaliExistingTourSave("wizard-edit-B");
  assert.ok(otherSave);
  otherSave();
  photoOne();
  photoOne();
  assert.equal(denaliPhotoUploadPending(session), true);
  assert.equal(beginDenaliExistingTourSave(session), null);
  photoTwo();
  assert.equal(denaliPhotoUploadPending(session), false);
  unsubscribe();

  const save = beginDenaliExistingTourSave(session);
  assert.ok(save);
  assert.equal(beginDenaliExistingTourSave(session), null);
  assert.equal(beginDenaliPhotoUpload(session), null);
  save();
  save();
  const resumed = beginDenaliPhotoUpload(session);
  assert.ok(resumed);
  resumed();
  assert.deepEqual(seen, [true, false]);
});

test("unsubscribing does not prematurely release a pending upload, but its finally does", async () => {
  const session = "wizard-edit-C";
  const unsubscribe = subscribeDenaliPhotoUploadPending(session, () => {});
  const network = Promise.withResolvers<never>();
  const done = (async () => {
    const finish = beginDenaliPhotoUpload(session);
    assert.ok(finish);
    try {
      await network.promise;
    } finally {
      finish();
    }
  })();
  unsubscribe();
  assert.equal(beginDenaliExistingTourSave(session), null);
  network.reject(new Error("synthetic upload abort"));
  await assert.rejects(done, /abort/);
  assert.equal(denaliPhotoUploadPending(session), false);
  const save = beginDenaliExistingTourSave(session);
  assert.ok(save);
  save();
});
