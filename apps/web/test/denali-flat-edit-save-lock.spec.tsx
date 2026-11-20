import assert from "node:assert/strict";
import { test } from "node:test";
import { File } from "node:buffer";

import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React, { useMemo, useRef, useState } from "react";

import { useDraftEngine } from "@app-tour/draft-engine/react";
import {
  denaliWizardFlatEditChromeSurface,
  type DenaliFlatEditTourLoadResult,
} from "@app-tour/workspace-denali/host/ui/chrome/wizard-flat-edit-chrome-surface";
import {
  DENALI_PHOTOS_TEST_IDS,
  DenaliPhotosField,
} from "@app-tour/workspace-denali/host/ui/fields/photos";
import type { UpdateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";

import { loadAppMessages } from "../src/i18n/load-messages";

const { useFlatEditPageCore: useDenaliFlatEditPageCore } = denaliWizardFlatEditChromeSurface;
type DenaliFlatEditPageCoreInput = Parameters<typeof useDenaliFlatEditPageCore>[0];
type DenaliFlatEditDraftEnvelope = NonNullable<DenaliFlatEditPageCoreInput["draftSync"]["data"]>;

const draft = (title: string) => ({ data: { title } });
const meta = { pluginId: "denali", wizardSessionId: "a1b2c3d4-e5f6-4789-a012-3456789abcde" };
const baseline = (title: string, rowVersion: number): DenaliFlatEditTourLoadResult => ({
  ok: true,
  rowVersion,
  baseline: draft(title),
  detail: {
    projection: {
      title,
      uiStatus: "draft",
      priceAmount: null,
      priceCurrency: null,
      departureAt: null,
      acceptedSeats: 0,
      capacity: null,
    },
  },
});
const plugin = {
  id: "denali",
  lifecycle: {},
  wizardHost: {
    validateDraftSync: ({ draft }: { draft: { data: { title: string } } }) => ({
      ok: draft.data.title !== "Invalid title",
      violations: [],
    }),
    prepareTourPatchPayload: ({
      draft,
      rowVersion,
    }: {
      draft: { data: { title: string } };
      rowVersion: number;
    }) => ({ expectedRowVersion: rowVersion, changes: { title: draft.data.title } }),
  },
} as unknown as WorkspacePlugin;
const gate = {
  published: true,
  loading: false,
  workspaceFormProfile: "platform_default",
  fieldRulesOverlay: {},
  allowedCanonicalPaths: [],
  templateSteps: [],
};

test("explicit Save locks editing through PATCH, canonical reload and async draft reset", async (t) => {
  const priorReact = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", { configurable: true, value: React });
  t.after(() => {
    if (priorReact === undefined) Reflect.deleteProperty(globalThis, "React");
    else Object.defineProperty(globalThis, "React", priorReact);
  });
  const uploadGate = Promise.withResolvers<Response>();
  t.mock.method(globalThis, "fetch", async (path: string) =>
    path === "/api/tours/wizard-photos" ? uploadGate.promise : Response.json({ items: [] })
  );
  const patch = Promise.withResolvers<{ ok: true; rowVersion: number }>();
  const abortedPatch = Promise.withResolvers<never>();
  const reload = Promise.withResolvers<DenaliFlatEditTourLoadResult>();
  const resetGate = Promise.withResolvers<void>();
  const writes: DenaliFlatEditDraftEnvelope[] = [];
  const resets: DenaliFlatEditDraftEnvelope[] = [];
  const submitted: UpdateTourPayload[] = [];
  let loads = 0;
  let completed = false;
  const loadTourBaseline: DenaliFlatEditPageCoreInput["loadTourBaseline"] = async () => {
    loads += 1;
    if (loads === 1) return baseline("Before save", 1);
    if (loads === 2) return reload.promise;
    return { ok: false, kind: "error", code: "SYNTHETIC_GET_FAILED" };
  };
  const updateTour: DenaliFlatEditPageCoreInput["updateTour"] = (payload) => {
    submitted.push(payload);
    if (submitted.length === 1) return patch.promise;
    if (submitted.length === 2) return abortedPatch.promise;
    return Promise.resolve({ ok: true, rowVersion: 3 });
  };
  const loadSubmitCatalog = async () => ({
    activeEquipmentIds: [],
    activeThemeIds: [],
    activeGuideLanguageIds: [],
    selectableLeaderIds: [],
    activeDestinationIds: [],
  });
  const form = renderHook(() => {
    const draftSchemaGateRef =
      useRef<DenaliFlatEditPageCoreInput["draftSchemaGateRef"]["current"]>(null);
    const [data, setData] = useState(() =>
      ({ form: draft("Before save"), meta: { ...meta, currentStepIndex: 0, sourceRowVersion: 1 } })
    );
    const draftSync = useMemo<DenaliFlatEditPageCoreInput["draftSync"]>(
      () => ({
        data,
        status: "IDLE",
        navLocked: false,
        setData: (next) => {
          writes.push(next);
          setData(next);
        },
        clearDraft: async () => {},
        clearDraftAndReset: async (next) => {
          resets.push(next);
          if (resets.length > 1) throw new Error("synthetic reset rejection");
          await resetGate.promise;
          setData(next);
        },
      }),
      [data]
    );
    const core = useDenaliFlatEditPageCore({
      tourId: "synthetic-tour",
      tenantId: "synthetic-tenant",
      canPublish: false,
      gate,
      plugin,
      draftSync,
      draftSchemaGateRef,
      envelopeMeta: meta,
      wizardSessionId: meta.wizardSessionId,
      loadTourBaseline,
      updateTour,
      loadSubmitCatalog,
      onAfterPatchSuccess: () => {
        completed = true;
      },
    });
    return { core, rulesReady: draftSchemaGateRef.current !== null };
  });
  t.after(() => form.unmount());
  await waitFor(() =>
    assert.equal(
      form.result.current.rulesReady && form.result.current.core.screen === "ready",
      true
    )
  );

  const saveBeforeRender = form.result.current.core.handlePatch;
  const lateHandler = form.result.current.core.onDraftChange;
  const photoId = "synthetic-photo";
  const messages = await loadAppMessages("fa");
  const photo = render(
    <NextIntlClientProvider locale="fa" timeZone="UTC" messages={messages}>
      <DenaliPhotosField
        draft={{ data: { category: "mountain_day", photos: [{ id: photoId, label: "Photo" }] } }}
        onDraftChange={() => lateHandler(draft("Uploaded photo"))}
        wizardSessionId={meta.wizardSessionId}
      />
    </NextIntlClientProvider>
  );
  t.after(() => photo.unmount());
  fireEvent.change(photo.getByTestId(DENALI_PHOTOS_TEST_IDS.uploadInput), {
    target: { files: [new File(["synthetic"], "photo.png", { type: "image/png" })] },
  });
  await waitFor(() => assert.equal(form.result.current.core.photoUploadPending, true));
  act(() => saveBeforeRender("save"));
  assert.equal(form.result.current.core.explicitSaveLocked, false);
  assert.equal(submitted.length, 0);
  await act(async () => uploadGate.resolve(
    Response.json({ storageKey: "synthetic-storage-key", photoId, contentType: "image/png" })
  ));
  await waitFor(() => assert.equal(form.result.current.core.photoUploadPending, false));
  assert.equal(writes.at(-1)?.form.data.title, "Uploaded photo");
  act(() => {
    lateHandler(draft("Submitted title"));
    saveBeforeRender("save");
  });
  await waitFor(() => assert.equal(submitted.length, 1));
  assert.deepEqual(submitted[0], { expectedRowVersion: 1, changes: { title: "Submitted title" } });

  act(() => lateHandler(draft("During PATCH")));
  assert.equal(
    writes.at(-1)?.form.data.title,
    "Submitted title",
    "late handler is blocked while PATCH is pending"
  );
  assert.equal(form.result.current.core.pendingIntent, "save");
  await act(async () => patch.resolve({ ok: true, rowVersion: 2 }));
  await waitFor(() => assert.equal(loads, 2));

  act(() => form.result.current.core.onDraftChange(draft("During GET")));
  assert.equal(
    writes.at(-1)?.form.data.title,
    "Submitted title",
    "GET is still in the save window"
  );
  assert.equal(form.result.current.core.pendingIntent, "save");
  await act(async () => reload.resolve(baseline("Canonical saved title", 2)));
  await waitFor(() => assert.equal(resets.length, 1));

  act(() => form.result.current.core.onDraftChange(draft("During reset")));
  assert.equal(
    writes.at(-1)?.form.data.title,
    "Submitted title",
    "async reset is still in the save window"
  );
  assert.equal(form.result.current.core.pendingIntent, "save");
  assert.equal(form.result.current.core.saved, false);
  assert.equal(resets[0]?.meta.sourceRowVersion, 2);

  await act(async () => resetGate.resolve());
  await waitFor(() => assert.equal(completed && form.result.current.core.saved, true));
  assert.equal(form.result.current.core.draft.data.title, "Canonical saved title");
  act(() => form.result.current.core.onDraftChange(draft("After save")));
  assert.equal(writes.at(-1)?.form.data.title, "After save");
  assert.equal(writes.at(-1)?.meta.sourceRowVersion, 2);

  act(() => form.result.current.core.handlePatch("save"));
  await waitFor(() => assert.equal(submitted.length, 2));
  assert.equal(form.result.current.core.explicitSaveLocked, true);
  await act(async () => abortedPatch.reject(new DOMException("Aborted in test", "AbortError")));
  await waitFor(() => assert.equal(form.result.current.core.explicitSaveLocked, false));
  assert.ok(form.result.current.core.submitError);
  assert.equal(form.result.current.core.draft.data.title, "After save");
  assert.equal(resets.length, 1, "failed PATCH does not reset the draft");
  act(() => form.result.current.core.onDraftChange(draft("After aborted save")));
  assert.equal(writes.at(-1)?.form.data.title, "After aborted save");

  act(() => form.result.current.core.onDraftChange(draft("Invalid title")));
  act(() => form.result.current.core.handlePatch("save"));
  await waitFor(() => assert.equal(form.result.current.core.submitError, "VALIDATION_FAILED"));
  assert.equal(form.result.current.core.explicitSaveLocked, false);
  assert.equal(submitted.length, 2, "validation failure never sends PATCH");

  act(() => form.result.current.core.onDraftChange(draft("Saved with recovery failure")));
  act(() => form.result.current.core.handlePatch("save"));
  await waitFor(() => assert.equal(resets.length, 2));
  await waitFor(() => assert.equal(form.result.current.core.explicitSaveLocked, false));
  assert.equal(form.result.current.core.submitError, null, "the successful PATCH remains saved");
  assert.equal(resets[1]?.form.data.title, "Saved with recovery failure");
  assert.equal(resets[1]?.meta.sourceRowVersion, 3);
});

for (const phase of ["PATCH", "GET"] as const) {
  test(`reused tour B is not reset by tour A's pending ${phase}`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({ items: [] }));
    const patchA = Promise.withResolvers<{ ok: true; rowVersion: number }>();
    const reloadA = Promise.withResolvers<DenaliFlatEditTourLoadResult>();
    const deletes: string[] = [];
    const patches: UpdateTourPayload[] = [];
    const completed: string[] = [];
    let loadsA = 0;
    const loadTourBaseline: DenaliFlatEditPageCoreInput["loadTourBaseline"] = async (tourId) => {
      if (tourId === "A") return ++loadsA === 1 ? baseline("Tour A", 1) : reloadA.promise;
      return baseline("Tour B", 7);
    };
    const form = renderHook(
      ({ tourId }: { tourId: string }) => {
        const draftSchemaGateRef =
          useRef<DenaliFlatEditPageCoreInput["draftSchemaGateRef"]["current"]>(null);
        const engine = useDraftEngine<DenaliFlatEditDraftEnvelope>({
          id: tourId,
          conflictStrategy: "REFETCH_REAPPLY",
          onFetch: async () => null,
          onPush: async (payload) => ({ ...payload, version: payload.version + 1 }),
          onDelete: async () => {
            deletes.push(tourId);
          },
        });
        const draftSync: DenaliFlatEditPageCoreInput["draftSync"] = {
          data: engine.state.data,
          status: engine.state.status,
          setData: engine.setDraftData,
          clearDraft: engine.clearDraft,
          clearDraftAndReset: engine.clearDraftAndReset,
          navLocked: false,
        };
        const core = useDenaliFlatEditPageCore({
          tourId,
          tenantId: "synthetic-tenant",
          canPublish: false,
          gate,
          plugin,
          draftSync,
          draftSchemaGateRef,
          envelopeMeta: { ...meta, wizardSessionId: tourId },
          wizardSessionId: tourId,
          loadTourBaseline,
          updateTour: (payload) => {
            patches.push(payload);
            return patchA.promise;
          },
          loadSubmitCatalog: async () => ({
            activeEquipmentIds: [],
            activeThemeIds: [],
            activeGuideLanguageIds: [],
            selectableLeaderIds: [],
            activeDestinationIds: [],
          }),
          onAfterPatchSuccess: () => {
            completed.push(tourId);
          },
        });
        return { core, rulesReady: draftSchemaGateRef.current !== null };
      },
      { initialProps: { tourId: "A" } }
    );
    t.after(() => form.unmount());
    await waitFor(() =>
      assert.equal(
        form.result.current.rulesReady && form.result.current.core.screen === "ready",
        true
      )
    );
    act(() => form.result.current.core.handlePatch("save"));
    await waitFor(() => assert.equal(patches.length, 1));
    if (phase === "GET") {
      await act(async () => patchA.resolve({ ok: true, rowVersion: 2 }));
      await waitFor(() => assert.equal(loadsA, 2));
    }
    form.rerender({ tourId: "B" });
    await waitFor(() => assert.equal(form.result.current.core.detail?.projection.title, "Tour B"));
    await act(async () => {
      patchA.resolve({ ok: true, rowVersion: 2 });
      reloadA.resolve(baseline("Canonical A", 2));
    });
    await waitFor(() => assert.equal(form.result.current.core.explicitSaveLocked, false));
    assert.deepEqual(deletes, [], "must never delete/reset the new route's draft");
    assert.deepEqual(completed, [], "must not refresh the new route for the old save");
    assert.equal(form.result.current.core.detail?.projection.title, "Tour B");
    assert.equal(form.result.current.core.draft.data.title, "Tour B");
  });
}
