import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import { saveDraft } from "./denaliWizardDraftSave";

function withMockLocalStorage(run: (storage: Record<string, string>) => void): void {
  const storageBackend = {
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
      localStorage: storageBackend,
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storageBackend,
  });

  try {
    run(storageBackend.store);
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
}

test("saveDraft: no-ops when NEXT_PUBLIC_ENABLE_DENALI_DRAFT is unset", () => {
  const prev = process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT;
  delete process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT;

  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  try {
    withMockLocalStorage((store) => {
      saveDraft("ws-flag-off", form, undefined);
      assert.equal(Object.keys(store).length, 0);
    });
  } finally {
    if (prev !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT = prev;
    }
  }
});

test("saveDraft: writes localStorage when NEXT_PUBLIC_ENABLE_DENALI_DRAFT=1", () => {
  const prev = process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT;
  process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT = "1";

  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.title = "Draft flag on";

  try {
    withMockLocalStorage((store) => {
      saveDraft("ws-flag-on", form, undefined);
      const raw = store["ws-flag-on"];
      assert.ok(typeof raw === "string" && raw.length > 0);
      assert.match(raw, /Draft flag on/);
    });
  } finally {
    if (prev !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT = prev;
    } else {
      delete process.env.NEXT_PUBLIC_ENABLE_DENALI_DRAFT;
    }
  }
});
