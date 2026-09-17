import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ensureCreateChromeReady,
  ensureCreateViewReady,
  ensureFlatEditChromeReady,
  ensureFlatEditFormReady,
  ensureFlatEditPageReady,
  ensureOperatorUiReady,
  ensureLabelsReady,
  ensureWizardSurfacesReady,
  ensureWizardHostReady,
  resolveCreateChromeCapability,
  resolveCreateViewCapability,
  resolveDraftShellCapability,
  resolveFlatEditChromeCapability,
  resolveFlatEditFormCapability,
  resolveFlatEditPageCapability,
  resolveHostProbeCapability,
  resolveLabelsCapability,
  resolveOperatorUiCapability,
  resolveTemplateGateCapability,
  resolveTourActionSubmitCapability,
  resolveWizardSurfacesCapability,
  resolveTemplatePresetCapability,
  resolveSettingsHubFallbackCapability,
  resolveTemplateEditorCapability,
  resolveTourListCategoryCapability,
  resolveSettingsDestinationCapability,
  resolveSettingsEquipmentUiCapability,
  ensureSettingsEquipmentUiReady,
  resolveSettingsExposureSurfacesUiCapability,
  ensureSettingsExposureSurfacesUiReady,
  resolveOperatorShellNavCapability,
  resolveFinanceNavCapability,
  resolveWalletNavCapability,
  resolveFinanceCaseMeaningCapability,
  resolveFinanceOpsCapability,
  resolveBookingOpsCapability,
  resolveMemberPortalRenderersCapability,
  getWorkspaceMemberPortalRenderer,
  registerWorkspaceMemberPortalRenderers,
  clearWorkspaceMemberPortalRenderersForTests,
  resolveWizardCreateCapability,
  resolveWizardHostCapability,
  type WorkspacePluginCapabilities,
  type WorkspaceWizardHostHooks,
} from "../src/public-api";

describe("workspace-plugin-capabilities — Phase 4r/4s", () => {
  it("SDK-4R-01 resolveWizardHostCapability prefers capabilities.wizardHost", () => {
    const legacy: WorkspaceWizardHostHooks = { reviewStepId: "legacy" };
    const viaCap: WorkspaceWizardHostHooks = { reviewStepId: "cap" };
    const capabilities: WorkspacePluginCapabilities = { wizardHost: viaCap };
    assert.equal(
      resolveWizardHostCapability({ wizardHost: legacy, capabilities })?.reviewStepId,
      "cap"
    );
  });

  it("SDK-4R-02 resolveWizardHostCapability falls back to top-level wizardHost", () => {
    const legacy: WorkspaceWizardHostHooks = { reviewStepId: "legacy" };
    assert.equal(resolveWizardHostCapability({ wizardHost: legacy })?.reviewStepId, "legacy");
    assert.equal(resolveWizardHostCapability({}), undefined);
  });

  it("SDK-4R-03 ensureWizardHostReady awaits resolved ensureReady", async () => {
    let calls = 0;
    const wizardHost: WorkspaceWizardHostHooks = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    await ensureWizardHostReady({
      wizardHost: { reviewStepId: "unused" },
      capabilities: { wizardHost },
    });
    assert.equal(calls, 1);
    await ensureWizardHostReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4S-01 resolveHostProbeCapability reads capabilities.hostProbe only", () => {
    const capabilities: WorkspacePluginCapabilities = {
      hostProbe: { title: "T", body: "B" },
    };
    assert.deepEqual(resolveHostProbeCapability({ capabilities }), { title: "T", body: "B" });
    assert.equal(resolveHostProbeCapability({}), undefined);
  });

  it("SDK-4V-01 resolveDraftShellCapability reads capabilities.draftShell", () => {
    const draftShell = {
      createTourDraftKey: "k",
      operatorDraftNamespace: "ns",
      editTourDraftKey: (id: string) => `edit-${id}`,
      createWizardDraftSessionId: () => "sess",
    };
    assert.equal(
      resolveDraftShellCapability({ capabilities: { draftShell } })?.createTourDraftKey,
      "k"
    );
    assert.equal(resolveDraftShellCapability({}), undefined);
  });

  it("SDK-4W-01 draftShell may expose isFreshStartEnvelope + resolveDraftMerge", () => {
    const draftShell = {
      createTourDraftKey: "k",
      operatorDraftNamespace: "ns",
      editTourDraftKey: (id: string) => `edit-${id}`,
      createWizardDraftSessionId: () => "sess",
      isFreshStartEnvelope: (envelope: unknown) =>
        Boolean(envelope && typeof envelope === "object" && "fresh" in (envelope as object)),
      resolveDraftMerge: (mode: string) =>
        mode === "on" ? undefined : (local: unknown, _server: unknown) => local,
    };
    const resolved = resolveDraftShellCapability({ capabilities: { draftShell } });
    assert.equal(resolved?.isFreshStartEnvelope?.({ fresh: true }), true);
    assert.equal(typeof resolved?.resolveDraftMerge?.("off"), "function");
    assert.equal(resolved?.resolveDraftMerge?.("on"), undefined);
  });

  it("SDK-4Y-01 draftShell may expose buildCreatePrefilledForm", () => {
    const draftShell = {
      createTourDraftKey: "k",
      operatorDraftNamespace: "ns",
      editTourDraftKey: (id: string) => `edit-${id}`,
      createWizardDraftSessionId: () => "sess",
      buildCreatePrefilledForm: (gate: unknown) => ({ prefilled: true, gate }),
    };
    const resolved = resolveDraftShellCapability({ capabilities: { draftShell } });
    assert.deepEqual(resolved?.buildCreatePrefilledForm?.({ seed: "x" }), {
      prefilled: true,
      gate: { seed: "x" },
    });
  });

  it("SDK-4Z-01 draftShell may expose createDraftSchemaGate", () => {
    const draftShell = {
      createTourDraftKey: "k",
      operatorDraftNamespace: "ns",
      editTourDraftKey: (id: string) => `edit-${id}`,
      createWizardDraftSessionId: () => "sess",
      createDraftSchemaGate: (rules: unknown, evalContext: unknown) => ({
        rules,
        evalContext,
      }),
    };
    const resolved = resolveDraftShellCapability({ capabilities: { draftShell } });
    assert.deepEqual(resolved?.createDraftSchemaGate?.("r", "e"), {
      rules: "r",
      evalContext: "e",
    });
  });

  it("SDK-4AA-01 draftShell may expose isDraftEssentiallyEmpty", () => {
    const draftShell = {
      createTourDraftKey: "k",
      operatorDraftNamespace: "ns",
      editTourDraftKey: (id: string) => `edit-${id}`,
      createWizardDraftSessionId: () => "sess",
      isDraftEssentiallyEmpty: (draft: unknown) =>
        Boolean(draft && typeof draft === "object" && "empty" in (draft as object)),
    };
    const resolved = resolveDraftShellCapability({ capabilities: { draftShell } });
    assert.equal(resolved?.isDraftEssentiallyEmpty?.({ empty: true }), true);
    assert.equal(resolved?.isDraftEssentiallyEmpty?.({}), false);
  });

  it("SDK-4AM-01 draftShell may expose readDraftFieldValue + logTombstoneShadowMismatch", () => {
    const draftShell = {
      createTourDraftKey: "k",
      operatorDraftNamespace: "ns",
      editTourDraftKey: (id: string) => `edit-${id}`,
      createWizardDraftSessionId: () => "sess",
      readDraftFieldValue: (draft: Record<string, unknown>, path: string) =>
        (draft as { data?: Record<string, unknown> }).data?.[path],
      logTombstoneShadowMismatch: () => undefined,
    };
    const resolved = resolveDraftShellCapability({ capabilities: { draftShell } });
    assert.equal(resolved?.readDraftFieldValue?.({ data: { title: "T" } }, "title"), "T");
    assert.equal(typeof resolved?.logTombstoneShadowMismatch, "function");
  });

  it("SDK-4AB-01 resolveCreateChromeCapability reads capabilities.createChrome", async () => {
    let calls = 0;
    const createChrome = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveCreateChromeCapability({ capabilities: { createChrome } })?.ensureReady,
      createChrome.ensureReady
    );
    await ensureCreateChromeReady({ capabilities: { createChrome } });
    assert.equal(calls, 1);
    assert.equal(resolveCreateChromeCapability({}), undefined);
    await ensureCreateChromeReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AC-01 resolveFlatEditChromeCapability reads capabilities.flatEditChrome", async () => {
    let calls = 0;
    const flatEditChrome = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveFlatEditChromeCapability({ capabilities: { flatEditChrome } })?.ensureReady,
      flatEditChrome.ensureReady
    );
    await ensureFlatEditChromeReady({ capabilities: { flatEditChrome } });
    assert.equal(calls, 1);
    assert.equal(resolveFlatEditChromeCapability({}), undefined);
    await ensureFlatEditChromeReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AD-01 resolveCreateViewCapability reads capabilities.createView", async () => {
    let calls = 0;
    const createView = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveCreateViewCapability({ capabilities: { createView } })?.ensureReady,
      createView.ensureReady
    );
    await ensureCreateViewReady({ capabilities: { createView } });
    assert.equal(calls, 1);
    assert.equal(resolveCreateViewCapability({}), undefined);
    await ensureCreateViewReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AE-01 resolveFlatEditFormCapability reads capabilities.flatEditForm", async () => {
    let calls = 0;
    const flatEditForm = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveFlatEditFormCapability({ capabilities: { flatEditForm } })?.ensureReady,
      flatEditForm.ensureReady
    );
    await ensureFlatEditFormReady({ capabilities: { flatEditForm } });
    assert.equal(calls, 1);
    assert.equal(resolveFlatEditFormCapability({}), undefined);
    await ensureFlatEditFormReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AF-01 resolveFlatEditPageCapability reads capabilities.flatEditPage", async () => {
    let calls = 0;
    const flatEditPage = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveFlatEditPageCapability({ capabilities: { flatEditPage } })?.ensureReady,
      flatEditPage.ensureReady
    );
    await ensureFlatEditPageReady({ capabilities: { flatEditPage } });
    assert.equal(calls, 1);
    assert.equal(resolveFlatEditPageCapability({}), undefined);
    await ensureFlatEditPageReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AN-01 resolveTemplateGateCapability reads capabilities.templateGate", () => {
    const templateGate = {
      defaultPublishedStepId: "denali_basic",
      preferTemplateDefaultsOnPrefill: true,
      augmentFieldOverlays: <T extends { readonly canonicalPath: string }>(
        _steps: readonly { readonly fields: readonly T[] }[],
        base: ReadonlyMap<string, T>
      ) => base,
    };
    assert.equal(
      resolveTemplateGateCapability({ capabilities: { templateGate } })?.defaultPublishedStepId,
      "denali_basic"
    );
    assert.equal(
      resolveTemplateGateCapability({ capabilities: { templateGate } })
        ?.preferTemplateDefaultsOnPrefill,
      true
    );
    assert.equal(resolveTemplateGateCapability({}), undefined);
  });

  it("SDK-4AO-01 resolveOperatorUiCapability reads capabilities.operatorUi", async () => {
    let calls = 0;
    const operatorUi = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveOperatorUiCapability({ capabilities: { operatorUi } })?.ensureReady,
      operatorUi.ensureReady
    );
    await ensureOperatorUiReady({ capabilities: { operatorUi } });
    assert.equal(calls, 1);
    assert.equal(resolveOperatorUiCapability({}), undefined);
    await ensureOperatorUiReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AP-01 resolveTourActionSubmitCapability reads capabilities.tourActionSubmit", () => {
    const tourActionSubmit = {
      encode: (payload: { status: number; code: string; message: string }) => `X:${payload.code}`,
      decode: (raw: string) =>
        raw.startsWith("X:") ? { status: 400, code: raw.slice(2), message: "m" } : null,
    };
    assert.equal(
      resolveTourActionSubmitCapability({ capabilities: { tourActionSubmit } })?.encode({
        status: 1,
        code: "c",
        message: "m",
      }),
      "X:c"
    );
    assert.equal(resolveTourActionSubmitCapability({}), undefined);
  });

  it("SDK-4AQ-01 resolveLabelsCapability reads capabilities.labels", async () => {
    let calls = 0;
    const labels = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveLabelsCapability({ capabilities: { labels } })?.ensureReady,
      labels.ensureReady
    );
    await ensureLabelsReady({ capabilities: { labels } });
    assert.equal(calls, 1);
    assert.equal(resolveLabelsCapability({}), undefined);
    await ensureLabelsReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AS-01 resolveWizardSurfacesCapability reads capabilities.wizardSurfaces", async () => {
    let calls = 0;
    const wizardSurfaces = {
      ensureReady: async () => {
        calls += 1;
      },
    };
    assert.equal(
      resolveWizardSurfacesCapability({ capabilities: { wizardSurfaces } })?.ensureReady,
      wizardSurfaces.ensureReady
    );
    await ensureWizardSurfacesReady({ capabilities: { wizardSurfaces } });
    assert.equal(calls, 1);
    assert.equal(resolveWizardSurfacesCapability({}), undefined);
    await ensureWizardSurfacesReady({});
    assert.equal(calls, 1);
  });

  it("SDK-4AU-01 resolveTemplatePresetCapability reads capabilities.templatePreset", () => {
    const templatePreset = {
      buildFullTemplatePreset: (seedLabel?: string) => ({ seedLabel: seedLabel ?? "x", steps: [] }),
    };
    assert.equal(
      resolveTemplatePresetCapability({ capabilities: { templatePreset } })
        ?.buildFullTemplatePreset,
      templatePreset.buildFullTemplatePreset
    );
    assert.equal(resolveTemplatePresetCapability({}), undefined);
  });

  it("SDK-4AV-01 resolveSettingsHubFallbackCapability reads capabilities.settingsHubFallback", () => {
    const settingsHubFallback = {
      requiredModuleIds: ["integrations"] as const,
      fallbackModules: {
        integrations: {
          id: "integrations",
          kind: "readonly_explorer" as const,
          route: "settings/integrations",
          ability: "operator.settings.integrations",
          nav: { group: "workspace" as const, labelKey: "settings.integrations" },
        },
      },
    };
    assert.equal(
      resolveSettingsHubFallbackCapability({ capabilities: { settingsHubFallback } })
        ?.requiredModuleIds,
      settingsHubFallback.requiredModuleIds
    );
    assert.equal(resolveSettingsHubFallbackCapability({}), undefined);
  });

  it("SDK-4AW-01 resolveTemplateEditorCapability reads capabilities.templateEditor", () => {
    const templateEditor = {
      messageNamespace: "denali",
      photosStepId: "photos",
      isLongDescriptionVisible: () => true,
      patchLongDescriptionVisibility: (
        fieldRulesOverlay: Record<string, unknown> | undefined,
        _visible: boolean
      ) => fieldRulesOverlay ?? {},
      resolveCatalogFieldMeta: () => null,
      resolveCompositeRendererIdForAnchor: () => null,
      isFrozenTemplateCanonicalPath: () => false,
      normalizePublishedPayloadSteps: <T extends { published?: boolean }>(payload: T) => payload,
    };
    assert.equal(
      resolveTemplateEditorCapability({ capabilities: { templateEditor } })?.messageNamespace,
      "denali"
    );
    assert.equal(resolveTemplateEditorCapability({}), undefined);
  });

  it("SDK-4AX-01 resolveTourListCategoryCapability reads capabilities.tourListCategory", () => {
    const tourListCategory = {
      tourKindValues: ["mountain_day"] as const,
      filterGroups: [{ id: "mountain", slugs: ["mountain_day"] }],
      isTourKindSlug: (value: string | null) => value === "mountain_day",
      isTourCategoryGroup: (value: string) => value === "mountain",
      resolveTourKindDuration: (_category: string | null) => "single_day" as const,
    };
    assert.equal(
      resolveTourListCategoryCapability({ capabilities: { tourListCategory } })?.tourKindValues,
      tourListCategory.tourKindValues
    );
    assert.equal(resolveTourListCategoryCapability({}), undefined);
  });

  it("SDK-4AZ-01 resolveSettingsDestinationCapability reads capabilities.settingsDestination", () => {
    const settingsDestination = {
      locationTypes: [{ value: "peak" as const, metadataFields: ["altitudeM"] as const }],
      normalizeLocationType: (value: string | null | undefined) =>
        value === "peak" ? ("peak" as const) : ("generic" as const),
      metadataFieldsForType: (locationType: "generic" | "peak" | "nature_trail") =>
        locationType === "peak" ? (["altitudeM"] as const) : ([] as const),
    };
    assert.equal(
      resolveSettingsDestinationCapability({ capabilities: { settingsDestination } })
        ?.locationTypes,
      settingsDestination.locationTypes
    );
    assert.equal(resolveSettingsDestinationCapability({}), undefined);
  });

  it("SDK-4BA-01 resolveSettingsEquipmentUiCapability reads capabilities.settingsEquipmentUi", async () => {
    const settingsEquipmentUi = {
      ensureReady: async () => undefined,
    };
    assert.equal(
      resolveSettingsEquipmentUiCapability({ capabilities: { settingsEquipmentUi } })?.ensureReady,
      settingsEquipmentUi.ensureReady
    );
    await ensureSettingsEquipmentUiReady({ capabilities: { settingsEquipmentUi } });
    assert.equal(resolveSettingsEquipmentUiCapability({}), undefined);
    await ensureSettingsEquipmentUiReady({});
  });

  it("SDK-4BB-01 resolveSettingsExposureSurfacesUiCapability reads capabilities.settingsExposureSurfacesUi", async () => {
    const settingsExposureSurfacesUi = {
      ensureReady: async () => undefined,
    };
    assert.equal(
      resolveSettingsExposureSurfacesUiCapability({
        capabilities: { settingsExposureSurfacesUi },
      })?.ensureReady,
      settingsExposureSurfacesUi.ensureReady
    );
    await ensureSettingsExposureSurfacesUiReady({ capabilities: { settingsExposureSurfacesUi } });
    assert.equal(resolveSettingsExposureSurfacesUiCapability({}), undefined);
    await ensureSettingsExposureSurfacesUiReady({});
  });

  it("SDK-4BC-01 resolveOperatorShellNavCapability reads capabilities.operatorShellNav", () => {
    const operatorShellNav = {
      links: [{ href: "/catalog", labelKey: "catalog" }] as const,
    };
    assert.equal(
      resolveOperatorShellNavCapability({ capabilities: { operatorShellNav } })?.links,
      operatorShellNav.links
    );
    assert.equal(resolveOperatorShellNavCapability({}), undefined);
  });

  it("SDK-4BD-01 resolveFinanceNavCapability reads capabilities.financeNav", () => {
    const financeNav = { supported: true as const };
    assert.equal(resolveFinanceNavCapability({ capabilities: { financeNav } })?.supported, true);
    assert.equal(resolveFinanceNavCapability({}), undefined);
  });

  it("SDK-WALLET-P3B-01 resolveWalletNavCapability reads capabilities.walletNav", () => {
    const walletNav = { supported: true as const };
    assert.equal(resolveWalletNavCapability({ capabilities: { walletNav } })?.supported, true);
    assert.equal(resolveWalletNavCapability({}), undefined);
  });

  it("SDK-4BE-01 resolveFinanceOpsCapability reads capabilities.financeOps", () => {
    const financeOps = {
      resolveManifest: (_theme?: unknown | null) => ({ version: "1" as const }),
    };
    assert.equal(
      resolveFinanceOpsCapability({ capabilities: { financeOps } })?.resolveManifest,
      financeOps.resolveManifest
    );
    assert.equal(resolveFinanceOpsCapability({}), undefined);
  });

  it("SDK-4BE-02 resolves optional Finance case meaning capability", () => {
    const financeCaseMeaning = { supported: true as const };
    assert.equal(
      resolveFinanceCaseMeaningCapability({ capabilities: { financeCaseMeaning } })?.supported,
      true
    );
    assert.equal(resolveFinanceCaseMeaningCapability({}), undefined);
  });

  it("SDK-4BE-03 registers a future member renderer without host dispatch", () => {
    clearWorkspaceMemberPortalRenderersForTests();
    const renderer = (props: { readonly moduleId: string }) => props.moduleId;
    registerWorkspaceMemberPortalRenderers("future-workspace", {
      renderers: { custom: renderer },
    });
    assert.equal(getWorkspaceMemberPortalRenderer("future-workspace", "custom"), renderer);
    clearWorkspaceMemberPortalRenderersForTests();
  });

  it("SDK-4BF-01 resolveBookingOpsCapability reads capabilities.bookingOps", () => {
    const bookingOps = {
      resolveManifest: (_theme?: unknown | null) => ({ id: "fixture_registration_ops" }) as never,
    };
    assert.equal(
      resolveBookingOpsCapability({ capabilities: { bookingOps } })?.resolveManifest,
      bookingOps.resolveManifest
    );
    assert.equal(resolveBookingOpsCapability({}), undefined);
  });

  it("SDK-4BG-01 resolveWizardCreateCapability reads capabilities.wizardCreate", () => {
    const wizardCreate = { extendedChrome: true as const };
    assert.equal(
      resolveWizardCreateCapability({ capabilities: { wizardCreate } })?.extendedChrome,
      true
    );
    assert.equal(resolveWizardCreateCapability({}), undefined);
  });
});
