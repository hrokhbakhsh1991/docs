import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
  catalogFieldIdsFromExposureFields,
  resolveEffectiveSelectedFieldIds,
  resolveExposureChecklistContext,
  resolveExposureFieldSelectionFromPersisted,
  resolveExposureIntentContextFromPersisted,
  resolveExposureIntentPatchInput,
  resolveExposureSelectionSaveInput,
  resolveExposureCatalogFieldsInSelectedOrder,
  resolveStoredVsEffectiveExposureContext,
  reorderExposureSelectedFieldId,
  setExposureFieldDecorationPrefix,
  setExposureCustomizeFields,
  toExposureChecklistFields,
  toggleExposureFieldSelection,
} from "../src/exposure/exposure-field-selection";

const CATALOG = ["title", "denali.destination", "details.summary"];

describe("resolveExposureChecklistContext", () => {
  it("derives surface from the connection provider", () => {
    assert.deepEqual(resolveExposureChecklistContext("telegram", "TourCreated"), {
      surface: "telegram",
      audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
      trigger: "TourCreated",
    });
  });

  it("does not hardcode telegram and falls back when provider is empty", () => {
    assert.equal(resolveExposureChecklistContext("slack", "TourUpdated").surface, "slack");
    assert.equal(resolveExposureChecklistContext("", "TourCreated").surface, "unknown");
    assert.equal(resolveExposureChecklistContext(null, "TourCreated").surface, "unknown");
  });
});

describe("inherit vs override selection", () => {
  it("inherit mode returns the full catalog as effective selection", () => {
    const state = { customizeFields: false, selectedFieldIds: [] as string[] };
    assert.deepEqual(resolveEffectiveSelectedFieldIds(state, CATALOG), CATALOG);
  });

  it("override mode returns the stored subset", () => {
    const state = { customizeFields: true, selectedFieldIds: ["title"] };
    assert.deepEqual(resolveEffectiveSelectedFieldIds(state, CATALOG), ["title"]);
  });

  it("toggling a field while inheriting seeds override from catalog without dropping defaults", () => {
    const state = { customizeFields: false, selectedFieldIds: [] as string[] };
    const next = toggleExposureFieldSelection(state, CATALOG, "title", false);
    assert.equal(next.customizeFields, true);
    assert.deepEqual(next.selectedFieldIds, ["denali.destination", "details.summary"]);
  });

  it("toggling a field on adds it without duplicates", () => {
    const state = { customizeFields: true, selectedFieldIds: ["title"] };
    const next = toggleExposureFieldSelection(state, CATALOG, "title", true);
    assert.deepEqual(next.selectedFieldIds, ["title"]);
    const added = toggleExposureFieldSelection(state, CATALOG, "details.summary", true);
    assert.deepEqual(added.selectedFieldIds, ["title", "details.summary"]);
  });

  it("entering customize seeds override from current effective selection", () => {
    const state = { customizeFields: false, selectedFieldIds: [] as string[] };
    const next = setExposureCustomizeFields(state, CATALOG, true);
    assert.equal(next.customizeFields, true);
    assert.deepEqual(next.selectedFieldIds, CATALOG);
  });

  it("leaving customize drops the stored override entirely", () => {
    const state = { customizeFields: true, selectedFieldIds: ["title"] };
    const next = setExposureCustomizeFields(state, CATALOG, false);
    assert.deepEqual(next, { customizeFields: false, selectedFieldIds: [] });
  });
});

describe("resolveExposureSelectionSaveInput", () => {
  it("inherit persists no override (disabled + empty)", () => {
    const state = { customizeFields: false, selectedFieldIds: ["title"] };
    assert.deepEqual(resolveExposureSelectionSaveInput(state), {
      enabled: false,
      selectedFieldIds: [],
    });
  });

  it("override persists the explicit subset", () => {
    const state = { customizeFields: true, selectedFieldIds: ["title", "details.summary"] };
    assert.deepEqual(resolveExposureSelectionSaveInput(state), {
      enabled: true,
      selectedFieldIds: ["title", "details.summary"],
    });
  });
});

describe("resolveExposureIntentContextFromPersisted", () => {
  it("falls back to provider and panel event type when dimensions are absent", () => {
    assert.deepEqual(resolveExposureIntentContextFromPersisted("telegram", "TourCreated"), {
      surface: "telegram",
      audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
      trigger: "TourCreated",
    });
  });

  it("hydrates explicit persisted dimensions", () => {
    assert.deepEqual(
      resolveExposureIntentContextFromPersisted("telegram", "TourCreated", {
        surface: "telegram",
        audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
        trigger: "TourPublished",
        eventType: "TourPublished",
      }),
      {
        surface: "telegram",
        audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
        trigger: "TourPublished",
      },
    );
  });
});

describe("resolveStoredVsEffectiveExposureContext", () => {
  it("marks route-scoped coordinate controls runtime-effective after save", () => {
    assert.deepEqual(
      resolveStoredVsEffectiveExposureContext({
        provider: "telegram",
        panelEventType: "TourCreated",
        persistedIntent: {
          eventType: "TourCreated",
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourPublished",
          routeScoped: true,
        },
      }),
      {
        stored: {
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourPublished",
        },
        effective: {
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourPublished",
        },
        storedDiffersFromEffective: false,
        coordinateControlsRuntimeEffective: true,
      },
    );
  });

  it("keeps legacy connection-only intents on route defaults until route scope exists", () => {
    assert.deepEqual(
      resolveStoredVsEffectiveExposureContext({
        provider: "telegram",
        panelEventType: "TourCreated",
        persistedIntent: {
          eventType: "TourPublished",
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourPublished",
          routeScoped: false,
        },
      }),
      {
        stored: {
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourPublished",
        },
        effective: {
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourCreated",
        },
        storedDiffersFromEffective: true,
        coordinateControlsRuntimeEffective: false,
      },
    );
  });
});

describe("resolveExposureIntentPatchInput", () => {
  it("includes full exposure context in the PATCH body", () => {
    assert.deepEqual(
      resolveExposureIntentPatchInput({
        selection: { customizeFields: true, selectedFieldIds: ["title"] },
        context: {
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourCreated",
        },
        template: "Hello",
      }),
      {
        enabled: true,
        selectedFieldIds: ["title"],
        surface: "telegram",
        audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
        trigger: "TourCreated",
        templateId: "Hello",
        fieldDecorations: null,
      },
    );
  });

  it("includes field decorations in the PATCH body", () => {
    assert.deepEqual(
      resolveExposureIntentPatchInput({
        selection: { customizeFields: true, selectedFieldIds: ["meetingPoint"] },
        context: {
          surface: "telegram",
          audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
          trigger: "TourCreated",
        },
        template: "",
        fieldDecorations: { meetingPoint: { prefix: "✅ 📍" } },
      }),
      {
        enabled: true,
        selectedFieldIds: ["meetingPoint"],
        surface: "telegram",
        audience: EXPOSURE_EXTERNAL_CHANNEL_AUDIENCE,
        trigger: "TourCreated",
        templateId: null,
        fieldDecorations: { meetingPoint: { prefix: "✅ 📍" } },
      },
    );
  });
});

describe("setExposureFieldDecorationPrefix", () => {
  it("sets and clears decoration prefixes", () => {
    assert.deepEqual(
      setExposureFieldDecorationPrefix({}, "meetingPoint", "✅ 📍"),
      { meetingPoint: { prefix: "✅ 📍" } },
    );
    assert.deepEqual(
      setExposureFieldDecorationPrefix(
        { meetingPoint: { prefix: "✅ 📍" } },
        "meetingPoint",
        "   ",
      ),
      {},
    );
  });
});

describe("exposure catalog boundary helpers", () => {
  it("toExposureChecklistFields projects catalog entries for the checklist component", () => {
    const fields = toExposureChecklistFields([
      {
        id: "title",
        canonicalPath: "title",
        adminLabel: "Title",
        group: "Basics",
      },
    ]);
    assert.deepEqual(fields, [
      { id: "title", canonicalPath: "title", adminLabel: "Title", group: "Basics" },
    ]);
  });

  it("resolveExposureFieldSelectionFromPersisted drops overrides when inherit is active", () => {
    assert.deepEqual(resolveExposureFieldSelectionFromPersisted(false, ["title"]), {
      customizeFields: false,
      selectedFieldIds: [],
    });
    assert.deepEqual(resolveExposureFieldSelectionFromPersisted(true, ["title"]), {
      customizeFields: true,
      selectedFieldIds: ["title"],
    });
  });

  it("catalogFieldIdsFromExposureFields returns stable ids", () => {
    assert.deepEqual(
      catalogFieldIdsFromExposureFields([
        { id: "title", canonicalPath: "title" },
        { id: "details.summary", canonicalPath: "details.summary" },
      ]),
      ["title", "details.summary"],
    );
  });
});

describe("selected field ordering", () => {
  it("reorderExposureSelectedFieldId moves one id within the effective selection", () => {
    const state = {
      customizeFields: true,
      selectedFieldIds: ["title", "denali.destination", "details.summary"],
    };
    assert.deepEqual(
      reorderExposureSelectedFieldId(state, CATALOG, "denali.destination", "up"),
      {
        customizeFields: true,
        selectedFieldIds: ["denali.destination", "title", "details.summary"],
      },
    );
    assert.deepEqual(
      reorderExposureSelectedFieldId(state, CATALOG, "title", "up"),
      state,
    );
  });

  it("resolveExposureCatalogFieldsInSelectedOrder follows selectedFieldIds, not catalog order", () => {
    const fields = [
      { id: "title", canonicalPath: "title" },
      { id: "denali.destination", canonicalPath: "destinationId" },
      { id: "details.summary", canonicalPath: "details.summary" },
    ];
    assert.deepEqual(
      resolveExposureCatalogFieldsInSelectedOrder(fields, [
        "details.summary",
        "title",
        "denali.destination",
      ]),
      [
        { id: "details.summary", canonicalPath: "details.summary" },
        { id: "title", canonicalPath: "title" },
        { id: "denali.destination", canonicalPath: "destinationId" },
      ],
    );
  });
});
