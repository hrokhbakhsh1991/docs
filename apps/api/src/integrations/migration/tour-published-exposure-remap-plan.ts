import type { ExposureFieldDecorations, ExposureIntentMode } from "../../exposure/exposure-intent";
import type { ExposureIntentScope, UpsertExposureIntentInput } from "../../exposure/exposure-intent.repository";
import { exposureIntentScopeHash } from "../../exposure/exposure-intent.repository";
import { supportsTourPublishedExposureRemap } from "../../integrations/platform/workspace-integration-capabilities.generated.ts";

export const TOUR_PUBLISHED_EXPOSURE_REMAP_SOURCE =
  "tour_published_trigger_migration_v1" as const;

export const TOUR_CREATED_SEEDED_TEMPLATE = "Tour created: {{title}}" as const;
export const TOUR_PUBLISHED_SEEDED_TEMPLATE = "Tour published: {{title}}" as const;

export type ExposureIntentRemapCandidate = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly profileId: string;
  readonly entityType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly scope: ExposureIntentScope;
  readonly mode: ExposureIntentMode;
  readonly selectedFieldIds: readonly string[];
  readonly fieldDecorations?: ExposureFieldDecorations;
  readonly templateOverrideId?: string | null;
};

export type TourPublishedExposureRemapAction =
  | "remap"
  | "merge"
  | "skip_already_published"
  | "skip_invalid";

export type TourPublishedExposureRemapPlanItem = {
  readonly action: TourPublishedExposureRemapAction;
  readonly sourceIntentId: string;
  readonly tenantId: string;
  readonly connectionId: string | null;
  readonly reason?: string;
  readonly targetUpsert?: UpsertExposureIntentInput;
  readonly mergeTargetIntentId?: string;
};

export function isTourPublishedExposureRemapCandidate(
  row: Pick<
    ExposureIntentRemapCandidate,
    "workspaceType" | "surface" | "profileId" | "trigger"
  >,
): boolean {
  if (!supportsTourPublishedExposureRemap(row.workspaceType, row.surface)) {
    return false;
  }
  return row.trigger === "TourCreated" || row.profileId.endsWith(".TourCreated");
}

export function rewriteTourPublishedTemplateOverride(
  templateOverrideId: string | null | undefined,
): string | null {
  if (templateOverrideId == null) {
    return null;
  }
  const trimmed = templateOverrideId.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed === TOUR_CREATED_SEEDED_TEMPLATE) {
    return TOUR_PUBLISHED_SEEDED_TEMPLATE;
  }
  return trimmed;
}

export function buildTourPublishedRemapUpsert(
  source: ExposureIntentRemapCandidate,
): UpsertExposureIntentInput {
  const connectionId =
    typeof source.scope.connectionId === "string" ? source.scope.connectionId : undefined;
  const profileId = source.profileId.endsWith(".TourCreated")
    ? source.profileId.replace(/\.TourCreated$/, ".TourPublished")
    : `${source.workspaceType ?? "denali"}.telegram.TourPublished`;

  return {
    tenantId: source.tenantId,
    workspaceType: source.workspaceType,
    profileId,
    entityType: source.entityType,
    surface: source.surface,
    audience: source.audience,
    trigger: "TourPublished",
    scope: {
      ...source.scope,
      ...(connectionId === undefined ? {} : { connectionId }),
      eventType: "TourPublished",
    },
    mode: source.mode,
    selectedFieldIds: [...source.selectedFieldIds],
    ...(source.fieldDecorations === undefined ? {} : { fieldDecorations: source.fieldDecorations }),
    templateOverrideId: rewriteTourPublishedTemplateOverride(source.templateOverrideId),
  };
}

function uniqueFieldIds(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    ordered.push(trimmed);
  }
  return ordered;
}

export function mergeTourPublishedRemapUpsert(
  target: ExposureIntentRemapCandidate,
  source: ExposureIntentRemapCandidate,
): UpsertExposureIntentInput {
  const base = buildTourPublishedRemapUpsert(target);
  const mergedFieldIds = uniqueFieldIds([
    ...target.selectedFieldIds,
    ...source.selectedFieldIds,
  ]);
  const mergedMode: ExposureIntentMode =
    target.mode === "override_fields" || source.mode === "override_fields"
      ? "override_fields"
      : target.mode === "disabled" || source.mode === "disabled"
        ? "disabled"
        : "inherit_profile";
  const templateOverrideId =
    rewriteTourPublishedTemplateOverride(source.templateOverrideId) ??
    rewriteTourPublishedTemplateOverride(target.templateOverrideId);

  return {
    ...base,
    mode: mergedMode,
    selectedFieldIds: mergedFieldIds,
    templateOverrideId,
    ...(target.fieldDecorations === undefined && source.fieldDecorations === undefined
      ? {}
      : {
          fieldDecorations: {
            ...(target.fieldDecorations ?? {}),
            ...(source.fieldDecorations ?? {}),
          },
        }),
  };
}

export function tourPublishedRemapTargetKey(input: UpsertExposureIntentInput): string {
  return [
    input.tenantId,
    input.profileId,
    input.surface,
    input.audience,
    input.trigger,
    exposureIntentScopeHash(input.scope),
  ].join("|");
}

export function planTourPublishedExposureRemap(input: {
  readonly source: ExposureIntentRemapCandidate;
  readonly existingTarget: ExposureIntentRemapCandidate | null;
}): TourPublishedExposureRemapPlanItem {
  const connectionId =
    typeof input.source.scope.connectionId === "string"
      ? input.source.scope.connectionId
      : null;

  if (!isTourPublishedExposureRemapCandidate(input.source)) {
    return {
      action: "skip_invalid",
      sourceIntentId: input.source.id,
      tenantId: input.source.tenantId,
      connectionId,
      reason: "not_a_remap_candidate",
    };
  }

  if (
    input.source.trigger === "TourPublished" &&
    input.source.profileId.endsWith(".TourPublished")
  ) {
    return {
      action: "skip_already_published",
      sourceIntentId: input.source.id,
      tenantId: input.source.tenantId,
      connectionId,
    };
  }

  const targetUpsert = buildTourPublishedRemapUpsert(input.source);

  if (
    input.existingTarget !== null &&
    input.existingTarget.id !== input.source.id
  ) {
    return {
      action: "merge",
      sourceIntentId: input.source.id,
      tenantId: input.source.tenantId,
      connectionId,
      mergeTargetIntentId: input.existingTarget.id,
      targetUpsert: mergeTourPublishedRemapUpsert(input.existingTarget, input.source),
    };
  }

  return {
    action: "remap",
    sourceIntentId: input.source.id,
    tenantId: input.source.tenantId,
    connectionId,
    targetUpsert,
  };
}

export function indexTourPublishedTargetsByKey(
  rows: readonly ExposureIntentRemapCandidate[],
): ReadonlyMap<string, ExposureIntentRemapCandidate> {
  const map = new Map<string, ExposureIntentRemapCandidate>();
  for (const row of rows) {
    if (row.trigger !== "TourPublished" && !row.profileId.endsWith(".TourPublished")) {
      continue;
    }
    map.set(
      tourPublishedRemapTargetKey(buildTourPublishedRemapUpsert({
        ...row,
        trigger: "TourPublished",
        profileId: row.profileId.endsWith(".TourPublished")
          ? row.profileId
          : row.profileId.replace(/\.TourCreated$/, ".TourPublished"),
        scope: {
          ...row.scope,
          eventType: "TourPublished",
        },
      })),
      row,
    );
  }
  return map;
}

export function planTourPublishedExposureRemapBatch(
  sources: readonly ExposureIntentRemapCandidate[],
  publishedTargets: readonly ExposureIntentRemapCandidate[],
): readonly TourPublishedExposureRemapPlanItem[] {
  const targetIndex = indexTourPublishedTargetsByKey(publishedTargets);
  const plannedTargets = new Map<string, ExposureIntentRemapCandidate>();

  return sources.map((source) => {
    const targetUpsert = buildTourPublishedRemapUpsert(source);
    const targetKey = tourPublishedRemapTargetKey(targetUpsert);
    const existingTarget = targetIndex.get(targetKey) ?? plannedTargets.get(targetKey) ?? null;
    const plan = planTourPublishedExposureRemap({ source, existingTarget });
    if (
      (plan.action === "remap" || plan.action === "merge") &&
      plan.targetUpsert !== undefined
    ) {
      plannedTargets.set(targetKey, {
        ...source,
        id: plan.mergeTargetIntentId ?? `planned:${source.id}`,
        trigger: "TourPublished",
        profileId: plan.targetUpsert.profileId,
        scope: plan.targetUpsert.scope ?? source.scope,
        mode: plan.targetUpsert.mode,
        selectedFieldIds: plan.targetUpsert.selectedFieldIds ?? [],
        templateOverrideId: plan.targetUpsert.templateOverrideId ?? null,
      });
    }
    return plan;
  });
}
