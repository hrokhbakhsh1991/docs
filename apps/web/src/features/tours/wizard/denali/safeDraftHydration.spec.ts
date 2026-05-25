import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  parseDenaliWizardDraftRecord,
  serializeDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

import { getDenaliWizardDraftVersionHash } from "./denaliWizardDraftVersion";
import { resolveDenaliRuleSetFromTemplate } from "./validation/denaliRuleAccess";
import {
  DenaliDraftVersionMismatchError,
  isDenaliWizardDraftLoadable,
  persistDenaliWizardDraftBackupToStorage,
  persistDenaliWizardDraftToStorage,
  readDenaliWizardDraftBackupFromStorage,
  resolveDenaliWizardDraftBackupStorageKey,
  resolveDenaliWizardDraftHydration,
  tryHydrateDraft,
  tryMigrateDenaliWizardDraft,
} from "./safeDraftHydration";

const OVERLAY_HIDE_GUIDE_TEMPLATE: TenantWizardTemplate = {
  id: "t-draft-overlay",
  workspaceId: "w1",
  baseProfile: "denali_pilot",
  stepOverrides: { skip: [], insert: [] },
  fieldRulesOverlay: { requiresLocalGuide: { visibility: "hidden" } },
  presetId: null,
  canonicalData: {},
  wizardContractVersion: 1,
  formProfileVersion: 1,
};

test("tryHydrateDraft returns hydrated form when versionHash matches", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Safe hydration";

  const parsed = parseDenaliWizardDraftRecord(serializeDenaliWizardDraft(form, undefined));
  assert.ok(parsed);

  const hydrated = tryHydrateDraft(parsed, defaults);
  assert.ok(hydrated);
  assert.equal(hydrated.formValues.basicInfo.title, "Safe hydration");
});

test("tryHydrateDraft returns null when versionHash mismatches", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const parsed = parseDenaliWizardDraftRecord(
    JSON.stringify({
      _wizardRail: "denali",
      versionHash: "deadbeef",
      basicInfo: { title: "Stale draft" },
    }),
  );
  assert.ok(parsed);

  assert.equal(tryHydrateDraft(parsed, defaults), null);
  assert.equal(isDenaliWizardDraftLoadable(parsed), false);
  assert.equal(resolveDenaliWizardDraftHydration(parsed).status, "incompatible");
});

test("tryMigrateDenaliWizardDraft hydrates stale drafts with current rules", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const parsed = parseDenaliWizardDraftRecord(
    JSON.stringify({
      _wizardRail: "denali",
      versionHash: "deadbeef",
      basicInfo: { title: "Stale draft worth keeping" },
    }),
  );
  assert.ok(parsed);

  const migrated = tryMigrateDenaliWizardDraft(parsed, defaults);
  assert.ok(migrated);
  assert.equal(migrated.formValues.basicInfo.title, "Stale draft worth keeping");
});

test("tryHydrateDraft throws DenaliDraftVersionMismatchError when requested", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const parsed = parseDenaliWizardDraftRecord(
    JSON.stringify({
      _wizardRail: "denali",
      versionHash: "deadbeef",
      basicInfo: { title: "Stale draft" },
    }),
  );
  assert.ok(parsed);

  assert.throws(
    () => tryHydrateDraft(parsed, defaults, { throwOnVersionMismatch: true }),
    (err: unknown) => {
      assert.ok(err instanceof DenaliDraftVersionMismatchError);
      assert.equal(err.storedVersionHash, "deadbeef");
      assert.equal(err.currentVersionHash, getDenaliWizardDraftVersionHash());
      return true;
    },
  );
});

test("tryHydrateDraft clears ghost fields via rule engine", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";

  const parsed = parseDenaliWizardDraftRecord(serializeDenaliWizardDraft(form, undefined));
  const hydrated = tryHydrateDraft(parsed, defaults);

  assert.ok(hydrated);
  assert.equal(hydrated.formValues.basicInfo.endDateTime, undefined);
});

test("tryHydrateDraft applies workspace overlay when ruleSet is passed", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.requiresLocalGuide = true;
  form.basicInfo.localGuideName = "Guide Ali";

  const parsed = parseDenaliWizardDraftRecord(serializeDenaliWizardDraft(form, undefined));
  const ruleSet = resolveDenaliRuleSetFromTemplate(OVERLAY_HIDE_GUIDE_TEMPLATE);
  const hydrated = tryHydrateDraft(parsed, defaults, { ruleSet });

  assert.ok(hydrated);
  assert.equal(hydrated.formValues.basicInfo.requiresLocalGuide, undefined);
  assert.equal(hydrated.formValues.basicInfo.localGuideName, undefined);
});

test("persistDenaliWizardDraftToStorage syncs hidden registry fields out of saved draft", () => {
  const storage = {
    getItem(key: string) {
      return this.store[key] ?? null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    store: {} as Record<string, string>,
    get length() {
      return Object.keys(this.store).length;
    },
    key(index: number) {
      return Object.keys(this.store)[index] ?? null;
    },
    clear() {
      this.store = {};
    },
  };

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      ...originalWindow,
      location: { host: "localhost" },
      localStorage: storage,
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  try {
    const form = buildDenaliTourCreateDefaultValues();
    form.basicInfo.tourType = "mountain_day";
    form.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";

    persistDenaliWizardDraftToStorage("ws-test", form, undefined);
    const parsed = parseDenaliWizardDraftRecord(storage.store["ws-test"] ?? null);

    assert.ok(parsed);
    assert.equal(parsed.formPatch.basicInfo?.endDateTime, undefined);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});

test("persistDenaliWizardDraftBackupToStorage writes to backup key", () => {
  const storage = {
    getItem(key: string) {
      return this.store[key] ?? null;
    },
    setItem(key: string, value: string) {
      this.store[key] = value;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    store: {} as Record<string, string>,
    get length() {
      return Object.keys(this.store).length;
    },
    key(index: number) {
      return Object.keys(this.store)[index] ?? null;
    },
    clear() {
      this.store = {};
    },
  };

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      ...originalWindow,
      location: { host: "localhost" },
      localStorage: storage,
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  try {
    const form = buildDenaliTourCreateDefaultValues();
    form.basicInfo.title = "Backup draft title";

    persistDenaliWizardDraftBackupToStorage("ws-test", form, undefined);
    const backupKey = resolveDenaliWizardDraftBackupStorageKey("ws-test");
    assert.ok(storage.store[backupKey]);
    const parsed = readDenaliWizardDraftBackupFromStorage("ws-test");
    assert.ok(parsed);
    assert.equal(parsed.formPatch.basicInfo?.title, "Backup draft title");
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  }
});
