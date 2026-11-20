import assert from "node:assert/strict";
import { File } from "node:buffer";
import { test } from "node:test";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";

import { denaliPhotoUploadPending } from "../../../packages/workspaces/denali/src/ui/adapters/photo-edit-activity";
import {
  DENALI_PHOTOS_TEST_IDS,
  DenaliPhotosField,
} from "../../../packages/workspaces/denali/src/ui/fields/denali-photos-field";
import { loadAppMessages } from "../src/i18n/load-messages";

test("a delayed photo upload for tour A cannot update reused tour B with the same photo id", async (t) => {
  const priorReact = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", { configurable: true, value: React });
  t.after(() => {
    if (priorReact === undefined) Reflect.deleteProperty(globalThis, "React");
    else Object.defineProperty(globalThis, "React", priorReact);
  });
  const sessionA = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
  const sessionB = "a1b2c3d4-e5f6-4789-a012-3456789abcdf";
  const photoId = "same-photo-id";
  const networkA = Promise.withResolvers<Response>();
  const networkB = Promise.withResolvers<Response>();
  const states: unknown[] = [];
  const messages = await loadAppMessages("fa");
  const fetchMock = t.mock.method(globalThis, "fetch", async (path, options) => {
    assert.equal(path, "/api/tours/wizard-photos");
    assert.equal(options?.method, "POST");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("X-Photo-Id"), photoId);
    const uploadSession = headers.get("X-Wizard-Session-Id");
    assert.ok(uploadSession === sessionA || uploadSession === sessionB);
    return uploadSession === sessionA ? networkA.promise : networkB.promise;
  });
  const View = ({ sessionId, label }: { sessionId: string; label: string }) => (
    <NextIntlClientProvider locale="fa" timeZone="UTC" messages={messages}>
      <DenaliPhotosField
        draft={{ data: { category: "mountain_day", photos: [{ id: photoId, label }] } }}
        onDraftChange={(next) => states.push(next)}
        wizardSessionId={sessionId}
      />
    </NextIntlClientProvider>
  );
  const view = render(<View sessionId={sessionA} label="Tour A" />);
  t.after(() => view.unmount());
  const uploadInput = () =>
    view.getByTestId(DENALI_PHOTOS_TEST_IDS.uploadInput) as HTMLInputElement;
  const choosePhoto = () =>
    fireEvent.change(uploadInput(), {
      target: { files: [new File(["synthetic data"], "photo.png", { type: "image/png" })] },
    });
  choosePhoto();
  await waitFor(() => assert.equal(fetchMock.mock.callCount(), 1));
  assert.equal(denaliPhotoUploadPending(sessionA), true);
  view.rerender(<View sessionId={sessionB} label="Tour B" />);
  assert.equal(denaliPhotoUploadPending(sessionB), false);

  assert.equal(uploadInput().disabled, false, "B starts with fresh local upload state");
  choosePhoto();
  await waitFor(() => assert.equal(fetchMock.mock.callCount(), 2));
  assert.equal(denaliPhotoUploadPending(sessionB), true);

  await act(async () => {
    networkA.resolve(
      Response.json({ storageKey: "old-tour-A-photo", photoId, contentType: "image/png" })
    );
  });
  await waitFor(() => assert.equal(denaliPhotoUploadPending(sessionA), false));
  assert.deepEqual(states, [], "a completed upload from a previous tour must not change the draft");
  assert.equal(denaliPhotoUploadPending(sessionB), true, "A's release leaves B pending");
  assert.equal(uploadInput().disabled, true);
  await act(async () => {
    networkB.resolve(
      Response.json({ storageKey: "current-tour-B-photo", photoId, contentType: "image/png" })
    );
  });
  await waitFor(() => assert.equal(denaliPhotoUploadPending(sessionB), false));
  const serialized = JSON.stringify(states);
  assert.equal(states.length, 1);
  assert.match(serialized, /current-tour-B-photo/);
  assert.doesNotMatch(serialized, /old-tour-A-photo/);
});
