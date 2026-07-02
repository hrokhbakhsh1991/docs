import { Prisma } from "@prisma/client";

import { withTenantRls } from "../../db/with-tenant-rls";
import { disconnectPrisma, getPrismaAdmin } from "../../db/prisma";
import { createExposureIntentRepository } from "../../exposure/prisma-exposure-intent.repository";
import type { ExposureFieldDecorations } from "../../exposure/exposure-intent";
import type { ExposureIntentMode } from "../../exposure/exposure-intent";
import {
  isTourPublishedExposureRemapCandidate,
  planTourPublishedExposureRemapBatch,
  type ExposureIntentRemapCandidate,
  type TourPublishedExposureRemapPlanItem,
} from "./tour-published-exposure-remap-plan";

export type RunTourPublishedExposureRemapOptions = {
  readonly tenantId?: string;
  readonly dryRun: boolean;
};

export type RunTourPublishedExposureRemapResult = {
  readonly mode: "dry-run" | "apply";
  readonly planned: readonly TourPublishedExposureRemapPlanItem[];
  readonly applied: readonly TourPublishedExposureRemapPlanItem[];
  readonly skipped: readonly TourPublishedExposureRemapPlanItem[];
};

export type VerifyTourPublishedExposureRemapResult = {
  readonly remainingCandidates: number;
};

function parseScope(raw: Prisma.JsonValue): ExposureIntentRemapCandidate["scope"] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as ExposureIntentRemapCandidate["scope"];
}

function parseSelectedFieldIds(raw: Prisma.JsonValue | null): readonly string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function parseMode(value: string): ExposureIntentMode {
  return value === "override_fields" || value === "disabled" ? value : "inherit_profile";
}

function mapRow(row: {
  id: string;
  tenantId: string;
  workspaceType: string | null;
  profileId: string;
  entityType: string;
  surface: string;
  audience: string;
  trigger: string;
  scope: Prisma.JsonValue;
  mode: string;
  selectedFieldIds: Prisma.JsonValue | null;
  fieldDecorations: Prisma.JsonValue | null;
  templateOverrideId: string | null;
}): ExposureIntentRemapCandidate {
  return {
    id: row.id,
    tenantId: row.tenantId,
    workspaceType: row.workspaceType,
    profileId: row.profileId,
    entityType: row.entityType,
    surface: row.surface,
    audience: row.audience,
    trigger: row.trigger,
    scope: parseScope(row.scope),
    mode: parseMode(row.mode),
    selectedFieldIds: parseSelectedFieldIds(row.selectedFieldIds),
    ...(row.templateOverrideId == null || row.templateOverrideId.trim().length === 0
      ? {}
      : { templateOverrideId: row.templateOverrideId.trim() }),
    ...(row.fieldDecorations == null
      ? {}
      : { fieldDecorations: row.fieldDecorations as ExposureFieldDecorations }),
  };
}

async function listExposureIntentRows(
  tenantId?: string,
): Promise<ExposureIntentRemapCandidate[]> {
  const admin = getPrismaAdmin();
  const rows = await admin.exposureIntent.findMany({
    where: {
      workspaceType: "denali",
      surface: "telegram",
      ...(tenantId === undefined ? {} : { tenantId }),
    },
    orderBy: [{ tenantId: "asc" }, { updatedAt: "asc" }],
  });
  return rows.map(mapRow);
}

function splitRemapSets(rows: readonly ExposureIntentRemapCandidate[]): {
  readonly sources: readonly ExposureIntentRemapCandidate[];
  readonly publishedTargets: readonly ExposureIntentRemapCandidate[];
} {
  const sources: ExposureIntentRemapCandidate[] = [];
  const publishedTargets: ExposureIntentRemapCandidate[] = [];
  for (const row of rows) {
    if (isTourPublishedExposureRemapCandidate(row)) {
      sources.push(row);
      continue;
    }
    if (row.trigger === "TourPublished" || row.profileId.endsWith(".TourPublished")) {
      publishedTargets.push(row);
    }
  }
  return { sources, publishedTargets };
}

async function applyPlanItem(plan: TourPublishedExposureRemapPlanItem): Promise<void> {
  if (plan.targetUpsert === undefined) {
    return;
  }
  const repository = createExposureIntentRepository();
  await repository.upsert(plan.targetUpsert);
  await withTenantRls(plan.tenantId, async (tx) => {
    await tx.exposureIntent.deleteMany({
      where: {
        tenantId: plan.tenantId,
        id: plan.sourceIntentId,
      },
    });
  });
}

export async function runTourPublishedExposureRemap(
  options: RunTourPublishedExposureRemapOptions,
): Promise<RunTourPublishedExposureRemapResult> {
  const rows = await listExposureIntentRows(options.tenantId);
  const { sources, publishedTargets } = splitRemapSets(rows);
  const planned = planTourPublishedExposureRemapBatch(sources, publishedTargets);

  if (options.dryRun) {
    return {
      mode: "dry-run",
      planned,
      applied: [],
      skipped: planned.filter(
        (item) => item.action === "skip_already_published" || item.action === "skip_invalid",
      ),
    };
  }

  const applied: TourPublishedExposureRemapPlanItem[] = [];
  const skipped: TourPublishedExposureRemapPlanItem[] = [];
  for (const plan of planned) {
    if (plan.action === "skip_already_published" || plan.action === "skip_invalid") {
      skipped.push(plan);
      continue;
    }
    await applyPlanItem(plan);
    applied.push(plan);
  }

  return {
    mode: "apply",
    planned,
    applied,
    skipped,
  };
}

export async function verifyTourPublishedExposureRemap(
  tenantId?: string,
): Promise<VerifyTourPublishedExposureRemapResult> {
  const rows = await listExposureIntentRows(tenantId);
  const remainingCandidates = rows.filter(isTourPublishedExposureRemapCandidate).length;
  return { remainingCandidates };
}

export async function runTourPublishedExposureRemapCli(
  argv: readonly string[],
): Promise<void> {
  const tenantId = readArg(argv, "tenant");
  const dryRun = !argv.includes("--apply");
  const verifyOnly = argv.includes("--verify");

  try {
    if (verifyOnly) {
      const result = await verifyTourPublishedExposureRemap(tenantId);
      console.log(
        "TOUR_PUBLISHED_EXPOSURE_REMAP_VERIFY",
        JSON.stringify(result),
      );
      if (result.remainingCandidates > 0) {
        process.exitCode = 2;
      }
      return;
    }

    const result = await runTourPublishedExposureRemap({ tenantId, dryRun });
    console.log(
      "TOUR_PUBLISHED_EXPOSURE_REMAP_SUMMARY",
      JSON.stringify({
        mode: result.mode,
        planned: result.planned.length,
        applied: result.applied.length,
        skipped: result.skipped.length,
        remaps: result.planned.filter((item) => item.action === "remap").length,
        merges: result.planned.filter((item) => item.action === "merge").length,
      }),
    );
  } finally {
    await disconnectPrisma();
  }
}

function readArg(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of argv) {
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length).trim();
    }
  }
  return undefined;
}
