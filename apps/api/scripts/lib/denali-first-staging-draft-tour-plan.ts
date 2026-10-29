import { createHash } from "node:crypto";
import { buildOperatorSmokeDraftTour } from "../../src/fixtures/operator-smoke-published-tour.fixture";
import type { Tour } from "../../src/storage/tour-storage.interface";
import { FIRST_STAGING_TENANT } from "./denali-second-staging-fixtures";

const RUN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const CREATED_AT = "2026-10-29T00:00:00.000Z";
const UUID_NAMESPACE = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");

function firstStagingDraftTourId(runId: string): string {
  const chars = createHash("sha1")
    .update(UUID_NAMESPACE)
    .update(`denali-first-staging-draft-tour\0${FIRST_STAGING_TENANT.id}\0${runId}\0tour-draft`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16]!, 16) & 0x3) | 0x8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function stableJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, nested]) => [key, normalize(nested)])
      );
    }
    return item;
  };
  return JSON.stringify(normalize(value)) ?? "undefined";
}

export type FirstStagingDraftTourPlan = Readonly<{
  tenantId: string;
  runId: string;
  tour: Tour;
}>;

/** Build a single run-scoped A-only draft tour. It contains no registration or payment data. */
export function buildFirstStagingDraftTourPlan(runId: string): FirstStagingDraftTourPlan {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_RUN_ID_INVALID");
  }
  const id = firstStagingDraftTourId(runId);
  const title = `S2-E04 A draft ${runId}`;
  const base = buildOperatorSmokeDraftTour({
    tenantId: FIRST_STAGING_TENANT.id,
    createdAt: CREATED_AT,
  });
  const tour: Tour = {
    ...base,
    id,
    tenantId: FIRST_STAGING_TENANT.id,
    canonical: {
      ...base.canonical,
      data: {
        ...base.canonical.data,
        title,
        basics: { title },
        publishStatus: "draft",
        details: { summary: `S2-E04 A draft fixture [${runId}]` },
      },
    },
  };
  return { tenantId: FIRST_STAGING_TENANT.id, runId, tour };
}

/** Refuse ID reuse unless the persisted row is exactly this deterministic fixture. */
export function assertFirstStagingDraftTourRowMatches(
  current: Readonly<{ tenantId: string; canonical: unknown }> | null,
  expected: Readonly<{ tenantId: string; canonical: unknown }>
): boolean {
  if (current === null) return false;
  if (
    current.tenantId !== expected.tenantId ||
    stableJson(current.canonical) !== stableJson(expected.canonical)
  ) {
    throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_COLLISION");
  }
  return true;
}

/** Verify database scalar projections as well as canonical JSON before treating a row as our fixture. */
export function assertFirstStagingDraftTourStoredStateMatches(
  current: Readonly<{
    tenantId: string;
    canonical: unknown;
    title: string;
    publishStatus: string;
    schemaVersion: number;
    rowVersion: number;
    createdAt: Date | string;
  }> | null,
  expected: Tour
): boolean {
  const exists = assertFirstStagingDraftTourRowMatches(current, {
    tenantId: expected.tenantId,
    canonical: expected.canonical,
  });
  if (!exists || current === null) return exists;
  const expectedTitle = String(expected.canonical.data.title ?? "");
  const createdAt =
    current.createdAt instanceof Date
      ? current.createdAt.toISOString()
      : new Date(current.createdAt).toISOString();
  if (
    current.title !== expectedTitle ||
    current.publishStatus !== "draft" ||
    current.schemaVersion !== expected.canonical.schemaVersion ||
    current.rowVersion !== expected.rowVersion ||
    createdAt !== expected.createdAt
  ) {
    throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_COLLISION");
  }
  return true;
}

export type FirstStagingDraftTourDependencyCounts = Readonly<{
  operatorRegistrations: number;
  urbanRegistrations: number;
  transportAllocations: number;
  rosterFreezes: number;
  outboxEvents: number;
  exposureReminderActivations: number;
}>;

/** Never remove a draft once another workflow has attached business history to it. */
export function assertFirstStagingDraftTourHasNoDependencies(
  counts: FirstStagingDraftTourDependencyCounts
): void {
  if (
    Object.values(counts).some((count) => !Number.isSafeInteger(count) || count < 0 || count > 0)
  ) {
    throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_DEPENDENCY_FOUND");
  }
}

export function buildFirstStagingDraftTourManifest(plan: FirstStagingDraftTourPlan) {
  return {
    manifestVersion: 1 as const,
    source: "denali-first-staging-draft-tour" as const,
    tenantId: plan.tenantId,
    runId: plan.runId,
    tourId: plan.tour.id,
  } as const;
}

export function assertFirstStagingDraftTourManifest(
  value: unknown,
  expected: ReturnType<typeof buildFirstStagingDraftTourManifest>
): void {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "manifestVersion,runId,source,tenantId,tourId" ||
    Object.entries(expected).some(
      ([key, expectedValue]) => (value as Record<string, unknown>)[key] !== expectedValue
    )
  ) {
    throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_MANIFEST_REJECTED");
  }
}
