import type { ComponentType } from "react";
import type { TourFormProfile } from "@repo/types";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { resolveBindings } from "@/features/tours/wizard/bindings";

/** Profile-scoped UI hints for domain visibility / validation. */
export type UiContextOptions = Readonly<{
  workspaceFormProfile?: TourFormProfile;
  [key: string]: unknown;
}>;

export type HiddenFieldEviction = {
  readonly collectHiddenFormPaths: (input: {
    readonly form: unknown;
    readonly ruleContext: unknown;
    readonly uiOptions?: UiContextOptions;
  }) => readonly string[];
};

export type GearCatalogFilter = {
  readonly classificationFieldPath: string;
  readonly resolveCategorySlug: (
    fieldValue: unknown,
    profile: TourFormProfile,
  ) => string | undefined;
  readonly readFieldValue: (formValues: unknown, fieldPath: string) => unknown;
};

export type StepRailManifest = {
  readonly stepIds: readonly string[];
  readonly enableRailTestingOverrides: boolean;
  readonly resolveVisibleSteps: (input: {
    readonly form: unknown;
    readonly ruleContext: unknown;
    readonly stepIds: readonly string[];
    readonly enableRailTestingOverrides: boolean;
  }) => readonly string[];
};

export type StepPanelComponent = ComponentType<Record<string, never>>;
export type StepComponentRegistry = Readonly<Record<string, StepPanelComponent>>;

export type LayoutManifest = {
  readonly profile: TourFormProfile;
  readonly draftWatchDebounceMs: number;
  readonly lockNavigationDuringConflict: boolean;
  readonly lockNavigationDuringSubmit: boolean;
  readonly stepRail: StepRailManifest;
  readonly stepComponentMap: StepComponentRegistry;
  readonly gearCatalogFilter: GearCatalogFilter;
  readonly hiddenFieldEviction: HiddenFieldEviction;
};

export type LayoutOverrides = Partial<{
  draftWatchDebounceMs: number;
  lockNavigationDuringConflict: boolean;
  lockNavigationDuringSubmit: boolean;
  gearClassificationFieldPath: string;
  enableRailTestingOverrides: boolean;
}>;

export type LayoutBindings = {
  readonly buildStepRail: (overrides: LayoutOverrides | undefined) => StepRailManifest;
  readonly buildStepComponentMap: () => StepComponentRegistry;
  readonly buildGearCatalogFilter: (
    profile: TourFormProfile,
    overrides: LayoutOverrides | undefined,
  ) => GearCatalogFilter;
  readonly hiddenFieldEviction: HiddenFieldEviction;
};

export const DEFAULT_DRAFT_WATCH_DEBOUNCE_MS = 500;

const LAYOUT_CACHE_MAX = 32;

function readTemplateLayoutOverrides(
  template: TenantWizardTemplate | null | undefined,
): LayoutOverrides | undefined {
  if (template == null) {
    return undefined;
  }
  const raw = template.canonicalData?.wizardLayout;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  return raw as LayoutOverrides;
}

export function layoutCacheKey(
  profile: TourFormProfile,
  template: TenantWizardTemplate | null | undefined,
  stepComponentMap?: StepComponentRegistry,
): string {
  const overrides = readTemplateLayoutOverrides(template);
  return [
    profile,
    template?.id ?? "no-template",
    template?.wizardContractVersion ?? "",
    overrides?.draftWatchDebounceMs ?? DEFAULT_DRAFT_WATCH_DEBOUNCE_MS,
    overrides?.lockNavigationDuringConflict ?? true,
    overrides?.lockNavigationDuringSubmit ?? true,
    overrides?.gearClassificationFieldPath ?? "",
    overrides?.enableRailTestingOverrides ?? "",
    stepComponentMap != null ? "custom-step-panels" : "domain-step-panels",
  ].join("|");
}

const layoutCache = new Map<string, LayoutManifest>();
const layoutCacheOrder: string[] = [];

function rememberLayout(cacheKey: string, manifest: LayoutManifest): LayoutManifest {
  if (layoutCache.has(cacheKey)) {
    return layoutCache.get(cacheKey)!;
  }
  layoutCache.set(cacheKey, manifest);
  layoutCacheOrder.push(cacheKey);
  while (layoutCacheOrder.length > LAYOUT_CACHE_MAX) {
    const oldest = layoutCacheOrder.shift();
    if (oldest != null) {
      layoutCache.delete(oldest);
    }
  }
  return manifest;
}

/** Builds a wizard shell manifest for the active workspace profile. */
export function buildLayout(
  profile: TourFormProfile,
  template?: TenantWizardTemplate | null,
  options?: {
    readonly stepComponentMap?: StepComponentRegistry;
  },
): LayoutManifest {
  const bindings = resolveBindings(profile);
  const templateOverrides = readTemplateLayoutOverrides(template);
  const stepRail = bindings.buildStepRail(templateOverrides);

  return {
    profile,
    draftWatchDebounceMs:
      templateOverrides?.draftWatchDebounceMs ?? DEFAULT_DRAFT_WATCH_DEBOUNCE_MS,
    lockNavigationDuringConflict: templateOverrides?.lockNavigationDuringConflict ?? true,
    lockNavigationDuringSubmit: templateOverrides?.lockNavigationDuringSubmit ?? true,
    stepRail,
    stepComponentMap: options?.stepComponentMap ?? bindings.buildStepComponentMap(),
    gearCatalogFilter: bindings.buildGearCatalogFilter(profile, templateOverrides),
    hiddenFieldEviction: bindings.hiddenFieldEviction,
  };
}

/** Returns a referentially stable manifest for identical profile/template inputs. */
export function getWizardLayout(
  profile: TourFormProfile,
  template?: TenantWizardTemplate | null,
  options?: {
    readonly stepComponentMap?: StepComponentRegistry;
  },
): LayoutManifest {
  const cacheKey = layoutCacheKey(profile, template ?? null, options?.stepComponentMap);
  const cached = layoutCache.get(cacheKey);
  if (cached != null) {
    return cached;
  }
  return rememberLayout(cacheKey, buildLayout(profile, template ?? null, options));
}

export function resolveVisibleSteps(
  layout: LayoutManifest,
  form: unknown,
  ruleContext: unknown,
): readonly string[] {
  return layout.stepRail.resolveVisibleSteps({
    form,
    ruleContext,
    stepIds: layout.stepRail.stepIds,
    enableRailTestingOverrides: layout.stepRail.enableRailTestingOverrides,
  });
}

export function isNavigationLocked(input: {
  layout: LayoutManifest;
  submitLocked: boolean;
  draftStatus: string;
}): boolean {
  if (input.layout.lockNavigationDuringSubmit && input.submitLocked) {
    return true;
  }
  if (input.layout.lockNavigationDuringConflict && input.draftStatus === "CONFLICT_RESOLVING") {
    return true;
  }
  return false;
}

/** Clears RHF errors for paths returned by the layout eviction strategy. */
export function clearHiddenFieldErrors(input: {
  readonly form: unknown;
  readonly clearErrors: (path: string) => void;
  readonly eviction: HiddenFieldEviction;
  readonly ruleContext: unknown;
  readonly uiOptions?: UiContextOptions;
}): void {
  const paths = input.eviction.collectHiddenFormPaths({
    form: input.form,
    ruleContext: input.ruleContext,
    uiOptions: input.uiOptions,
  });
  for (const path of paths) {
    input.clearErrors(path);
  }
}

/** No-op step panels for node tests. */
export function createStepRegistryStub(stepIds: readonly string[]): StepComponentRegistry {
  const stub = (): null => null;
  const registry: Record<string, StepPanelComponent> = {};
  for (const stepId of stepIds) {
    registry[stepId] = stub;
  }
  return registry;
}

/** Test-only — clears memoized layout manifests. */
export function resetLayoutCacheForTests(): void {
  layoutCache.clear();
  layoutCacheOrder.length = 0;
}
