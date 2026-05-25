import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { TourWizardDraftRecord } from "@/lib/tour-wizard-draft.client";
import {
  serializeDenaliWizardDraft,
  parseDenaliWizardDraftRecord,
  DENALI_WIZARD_DRAFT_VERSION_HASH_KEY,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";

import { pickDenaliWizardDraftForRestore } from "./pickDenaliWizardDraftForRestore";

function localDraft(title: string, savedAt: string) {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = title;
  const raw = serializeDenaliWizardDraft(form, {
    savedAt,
    resolvedFormProfile: "denali_pilot",
    formProfileVersion: 1,
  });
  return parseDenaliWizardDraftRecord(raw)!;
}

function serverDraft(input: {
  title: string;
  updatedAt: string;
  version?: number;
  currentStepIndex?: number;
}): TourWizardDraftRecord {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = input.title;
  const payload = JSON.parse(
    serializeDenaliWizardDraft(form, {
      savedAt: input.updatedAt,
      resolvedFormProfile: "denali_pilot",
      formProfileVersion: 1,
    }),
  ) as Record<string, unknown>;

  return {
    id: "draft-1",
    currentStepIndex: input.currentStepIndex ?? 2,
    payload,
    version: input.version ?? 3,
    updatedAt: input.updatedAt,
  };
}

test("pickDenaliWizardDraftForRestore prefers newer compatible server draft", () => {
  const local = localDraft("local title", "2026-05-17T10:00:00.000Z");
  const server = serverDraft({
    title: "server title",
    updatedAt: "2026-05-17T12:00:00.000Z",
  });

  const pick = pickDenaliWizardDraftForRestore(local, server);
  assert.equal(pick?.source, "server");
  assert.equal(pick?.parsed.formPatch.basicInfo?.title, "server title");
  assert.equal(pick?.serverVersion, 3);
  assert.equal(pick?.currentStepIndex, 2);
});

test("pickDenaliWizardDraftForRestore keeps local when newer than server", () => {
  const local = localDraft("local newer", "2026-05-17T14:00:00.000Z");
  const server = serverDraft({
    title: "server older",
    updatedAt: "2026-05-17T12:00:00.000Z",
  });

  const pick = pickDenaliWizardDraftForRestore(local, server);
  assert.equal(pick?.source, "local");
  assert.equal(pick?.parsed.formPatch.basicInfo?.title, "local newer");
});

test("pickDenaliWizardDraftForRestore rejects incompatible server when local is compatible", () => {
  const local = localDraft("local ok", "2026-05-17T10:00:00.000Z");
  const server = serverDraft({
    title: "server stale hash",
    updatedAt: "2026-05-17T14:00:00.000Z",
  });
  server.payload[DENALI_WIZARD_DRAFT_VERSION_HASH_KEY] = "deadbeef";

  const pick = pickDenaliWizardDraftForRestore(local, server);
  assert.equal(pick?.source, "local");
});

test("pickDenaliWizardDraftForRestore restores server-only compatible draft", () => {
  const server = serverDraft({
    title: "server only",
    updatedAt: "2026-05-17T12:00:00.000Z",
  });

  const pick = pickDenaliWizardDraftForRestore(null, server);
  assert.equal(pick?.source, "server");
  assert.equal(pick?.parsed.formPatch.basicInfo?.title, "server only");
});
