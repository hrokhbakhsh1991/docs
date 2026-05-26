#!/usr/bin/env npx tsx
/**
 * Generates Denali wizard artifacts from {@link ../src/features/tours/wizard/denali/registry/denaliFieldRegistryData.ts}.
 *
 *   pnpm --filter web generate:denali-wizard
 *
 * Do not edit generated files by hand.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDenaliCanonicalMapFromRegistry,
  buildDenaliConditionallyRequiredCanonicalPathsFromRegistry,
  buildDenaliRuleSetFromRegistry,
} from "../src/features/tours/wizard/denali/registry/denaliRegistryCodegen";
import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliZodFieldKind,
} from "../src/features/tours/wizard/denali/registry/denaliFieldRegistryData";
import {
  DENALI_MATRIX_CELLS,
} from "../src/features/tours/wizard/denali/registry/denaliRuleMatrixRecipes";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  type DenaliRuleSet,
} from "../src/features/tours/wizard/denali/rules/denaliRuleModel.types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const GENERATED_DIR = join(
  WEB_ROOT,
  "src/features/tours/wizard/denali/rules/generated",
);
const SCHEMA_GENERATED = join(
  WEB_ROOT,
  "src/features/tours/wizard/schemas/denaliTourCreateBaseSchema.generated.ts",
);

const BANNER = `// DEPRECATED: DO NOT EDIT. AUTO-GENERATED.
/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: denaliFieldRegistryData.ts (+ denaliRuleMatrixRecipes.ts)
 * Run: pnpm --filter web generate:denali-wizard
 */\n`;

function formatRuleSetExport(ruleSet: DenaliRuleSet): string {
  const lines: string[] = [];
  lines.push("export const denaliRuleSet: DenaliRuleSet = {");

  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    lines.push(`  ${category}: {`);
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = ruleSet[category][duration];
      if (model == null) {
        lines.push(`    ${duration}: null,`);
        continue;
      }
      lines.push(`    ${duration}: {`);
      lines.push(`      category: "${category}",`);
      lines.push(`      duration: "${duration}",`);
      lines.push("      fields: [");
      for (const field of model.fields) {
        lines.push(
          `        { path: "${field.path}", required: ${field.required}, hidden: ${field.hidden}, step: "${field.step}" },`,
        );
      }
      lines.push("      ],");
      lines.push("    },");
    }
    lines.push("  },");
  }

  lines.push("};");
  return lines.join("\n");
}

function buildCanonicalMap(): Record<string, string> {
  return buildDenaliCanonicalMapFromRegistry();
}

const ZOD_FRAGMENTS: Record<DenaliZodFieldKind, string> = {
  title: `z
    .string()
    .trim()
    .max(TOUR_TITLE_MAX_LENGTH, \`عنوان نباید بیشتر از \${TOUR_TITLE_MAX_LENGTH} نویسه باشد.\`)
    .refine(
      (v) => v.length === 0 || v.length >= TOUR_TITLE_MIN_LENGTH,
      \`عنوان باید حداقل \${TOUR_TITLE_MIN_LENGTH} نویسه باشد.\`,
    )`,
  tourType: "denaliTourKindSchema",
  publishStatus: 'z.enum(["draft", "active"]).optional()',
  destinationId: "z.string().trim().optional()",
  isoDateTime: `z
    .string()
    .trim()
    .refine(isParsableIsoDateTime, "زمان شروع باید به‌صورت ISO datetime معتبر باشد.")`,
  isoDateTimeOptional: `z
    .string()
    .trim()
    .optional()
    .refine((v) => v == null || v === "" || isParsableIsoDateTime(v), {
      message: "زمان پایان باید به‌صورت ISO datetime معتبر باشد.",
    })
    .transform((v) => (v == null || v === "" ? undefined : v))`,
  capacityMax: "z.number().int().optional()",
  optionalInt: 'optionalInt("مقدار نمی‌تواند منفی باشد.")',
  optionalPositiveInt: "optionalPositiveInt(1)",
  stringOptional: "z.string().trim().optional()",
  stringArrayDefault: "z.array(z.string().trim()).default([])",
  booleanOptional: "z.boolean().optional()",
  socialMediaLink: "z.string().trim().max(2048).optional()",
  approximateReturnTime: "optionalApproximateReturnTimeSchema()",
  difficultyLevel: "z.number().min(1).max(10).optional()",
  itinerary: "z.array(denaliItineraryDayRowSchema).optional()",
  locationData: "denaliLocationDataSchema.optional()",
  gatheringPoints:
    "z.array(denaliGatheringPickupStationFormSchema).default([])",
  gearItems: "z.array(denaliGearItemSchema).optional()",
  transportMode: "denaliTransportModeSchema",
  adminCapacityApproval: "z.boolean().optional()",
  photos: `z
    .array(denaliImageFileAssetSchema)
    .max(DENALI_MAX_PHOTO_COUNT, "حداکثر ۱۰ عکس مجاز است.")
    .optional()`,
  paymentMode: 'z.literal("offline_receipt").optional()',
  fitnessLevel: 'z.enum(["low", "medium", "high"]).optional()',
  minRequiredPeaks: "z.number().int().min(1).max(4).optional()",
};

type ZodSection =
  | "basicInfo"
  | "programNature"
  | "transport"
  | "pricingPayment"
  | "participantRequirements"
  | "policies"
  | "photosData"
  | "tripDetails.logistics"
  | "tripDetails.overview"
  | "tripDetails.metrics";

function zodSectionForRhfPath(rhfPath: string): ZodSection {
  if (rhfPath.startsWith("basicInfo.")) return "basicInfo";
  if (rhfPath.startsWith("programNature.")) return "programNature";
  if (rhfPath.startsWith("transport.")) return "transport";
  if (rhfPath.startsWith("pricingPayment.")) return "pricingPayment";
  if (rhfPath.startsWith("participantRequirements.")) return "participantRequirements";
  if (rhfPath.startsWith("policies.")) return "policies";
  if (rhfPath.startsWith("photosData.")) return "photosData";
  if (rhfPath.startsWith("tripDetails.overview.")) return "tripDetails.overview";
  if (rhfPath.startsWith("tripDetails.metrics.")) return "tripDetails.metrics";
  return "tripDetails.logistics";
}

function zodKeyFromRhfPath(rhfPath: string, section: ZodSection): string {
  const sectionPrefix = `${section}.`;
  if (rhfPath.startsWith(sectionPrefix)) {
    return rhfPath.slice(sectionPrefix.length);
  }
  const dot = rhfPath.indexOf(".");
  return dot === -1 ? rhfPath : rhfPath.slice(dot + 1);
}

function buildZodSchemaFile(): string {
  const sections: Record<ZodSection, Map<string, string>> = {
    basicInfo: new Map(),
    programNature: new Map(),
    transport: new Map(),
    pricingPayment: new Map(),
    participantRequirements: new Map(),
    policies: new Map(),
    photosData: new Map(),
    "tripDetails.logistics": new Map(),
    "tripDetails.overview": new Map(),
    "tripDetails.metrics": new Map(),
  };

  for (const def of DENALI_FIELD_DEFINITIONS) {
    const section = zodSectionForRhfPath(def.rhfPath);
    const key = zodKeyFromRhfPath(def.rhfPath, section);
    const fragment = ZOD_FRAGMENTS[def.zodKind];
    if (!fragment) {
      throw new Error(`Missing Zod fragment for kind ${def.zodKind} (${def.canonicalPath})`);
    }
    sections[section].set(key, fragment);
  }

  // Location fields on basicInfo (registry) — ensure present even if only in logistics step
  for (const loc of ["startPoint", "summitPoint", "campPoint", "endPoint"]) {
    if (!sections.basicInfo.has(loc)) {
      sections.basicInfo.set(loc, ZOD_FRAGMENTS.locationData);
    }
  }

  function renderObject(name: string, map: Map<string, string>, indent = ""): string {
    const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    const inner = entries
      .map(([key, val]) => `${indent}  ${key}: ${val},`)
      .join("\n");
    return `const ${name} = z.object({\n${inner}\n${indent}});`;
  }

  const transportModeEnum = `const denaliTransportModeSchema = z.enum([
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
]);`;

  return `${BANNER}
import { z } from "zod";

import { DENALI_TOUR_KIND_VALUES, type DenaliTourKind } from "@repo/types";

import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "@/features/tours/models/tours-new-validation-messages";

import { denaliGearItemSchema } from "./denaliGearItemSchema";
import {
  denaliImageFileAssetSchema,
  DENALI_MAX_PHOTO_COUNT,
} from "./denaliFileAssetSchema";
import {
  denaliItineraryDayRowSchema,
  optionalApproximateReturnTimeSchema,
} from "./denaliItineraryDaySchema";
import { denaliGatheringPickupStationFormSchema } from "./denaliGatheringPickupStation.schema";
import { denaliLocationDataSchema } from "./denaliLocationDataSchema";

function optionalInt(minMessage?: string) {
  return z
    .union([z.number().int().min(0, minMessage), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}

function optionalPositiveInt(min = 1, message?: string) {
  return z
    .union([z.number().int().min(min, message), z.nan(), z.undefined(), z.null(), z.literal("")])
    .transform((v) => (v == null || Number.isNaN(v) || v === "" ? undefined : v))
    .optional();
}

function isParsableIsoDateTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

const denaliTourKindSchema = z.enum(
  DENALI_TOUR_KIND_VALUES as unknown as [DenaliTourKind, ...DenaliTourKind[]],
);

${transportModeEnum}

${renderObject("denaliBasicInfoSchema", sections.basicInfo)}

${renderObject("denaliProgramNatureSchema", sections.programNature)}

${renderObject("denaliTransportSchema", sections.transport)}

${renderObject("denaliPricingPaymentSchema", sections.pricingPayment)}

${renderObject("denaliParticipantRequirementsSchema", sections.participantRequirements)}

${renderObject("denaliPoliciesSchema", sections.policies)}

${renderObject("denaliPhotosSchema", sections.photosData)}

${renderObject("denaliTripDetailsOverviewSchema", sections["tripDetails.overview"])}

${renderObject("denaliTripDetailsMetricsSchema", sections["tripDetails.metrics"])}

const denaliTripDetailsLogisticsSchema = z.object({
  gatheringPoints: z.array(denaliGatheringPickupStationFormSchema).default([]),
}).default({ gatheringPoints: [] });

const denaliTourCreateObjectSchema = z.object({
  basicInfo: denaliBasicInfoSchema,
  programNature: denaliProgramNatureSchema,
  transport: denaliTransportSchema,
  pricingPayment: denaliPricingPaymentSchema,
  participantRequirements: denaliParticipantRequirementsSchema,
  policies: denaliPoliciesSchema,
  photosData: denaliPhotosSchema,
  tripDetails: z.object({
    logistics: denaliTripDetailsLogisticsSchema,
    overview: denaliTripDetailsOverviewSchema,
    metrics: denaliTripDetailsMetricsSchema,
  }).default({
    logistics: { gatheringPoints: [] },
    overview: { customServiceLabels: [] },
    metrics: {},
  }),
});

function rejectZeroAmount(
  value: unknown,
  ctx: z.RefinementCtx,
  path: (string | number)[],
  message: string,
): void {
  if (value === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  }
}

export const denaliTourCreateBaseSchema = denaliTourCreateObjectSchema.superRefine((data, ctx) => {
  rejectZeroAmount(
    data.basicInfo.capacityMax,
    ctx,
    ["basicInfo", "capacityMax"],
    "حداکثر ظرفیت باید حداقل ۱ باشد.",
  );
  rejectZeroAmount(
    data.transport.transportCost,
    ctx,
    ["transport", "transportCost"],
    "هزینه حمل‌ونقل باید بیشتر از صفر باشد.",
  );
  rejectZeroAmount(
    data.transport.dongAmount,
    ctx,
    ["transport", "dongAmount"],
    "مبلغ دنگ باید بیشتر از صفر باشد.",
  );
  if (data.pricingPayment.requiresPayment === true) {
    rejectZeroAmount(
      data.pricingPayment.basePricePerPerson,
      ctx,
      ["pricingPayment", "basePricePerPerson"],
      "قیمت باید بیشتر از صفر باشد.",
    );
  }
});

export type DenaliCreateTourWizardForm = z.infer<typeof denaliTourCreateBaseSchema>;
`;
}

function formatCanonicalMapExport(map: Record<string, string>): string {
  const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([canonical, form]) => `  "${canonical}": "${form}",`)
    .join("\n");
  return `export const DENALI_CANONICAL_TO_FORM_PATH_MAP: Record<string, string> = {\n${body}\n};`;
}

function formatConditionallyRequiredPathsExport(paths: readonly string[]): string {
  const body = paths.map((path) => `  "${path}",`).join("\n");
  return `export const DENALI_CONDITIONALLY_REQUIRED_CANONICAL_PATHS = [\n${body}\n] as const;`;
}

function main(): void {
  const ruleSet = buildDenaliRuleSetFromRegistry();

  // uniqueness check
  for (const cell of DENALI_MATRIX_CELLS) {
    const model = ruleSet[cell.split(":")[0] as keyof DenaliRuleSet]?.[
      cell.split(":")[1] as "single_day" | "multi_day"
    ];
    if (!model) continue;
    const seen = new Set<string>();
    for (const field of model.fields) {
      if (seen.has(field.path)) {
        throw new Error(`Duplicate path ${field.path} in ${cell}`);
      }
      seen.add(field.path);
    }
  }

  const ruleSetTs = `${BANNER}
import type { DenaliRuleSet } from "../denaliRuleModel.types";

${formatRuleSetExport(ruleSet)}

export const denaliRuleModelMountainMultiDay = denaliRuleSet.mountain.multi_day!;
`;

  const canonicalMapTs = `${BANNER}
${formatCanonicalMapExport(buildCanonicalMap())}
`;

  const conditionalRequiredTs = `${BANNER}
${formatConditionallyRequiredPathsExport(buildDenaliConditionallyRequiredCanonicalPathsFromRegistry())}
`;

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(join(GENERATED_DIR, "denaliRuleSet.generated.ts"), ruleSetTs, "utf8");
  writeFileSync(
    join(GENERATED_DIR, "denaliCanonicalPathMap.generated.ts"),
    canonicalMapTs,
    "utf8",
  );
  writeFileSync(
    join(GENERATED_DIR, "denaliConditionallyRequiredPaths.generated.ts"),
    conditionalRequiredTs,
    "utf8",
  );
  writeFileSync(SCHEMA_GENERATED, buildZodSchemaFile(), "utf8");

  console.log("Generated:");
  console.log(" -", join(GENERATED_DIR, "denaliRuleSet.generated.ts"));
  console.log(" -", join(GENERATED_DIR, "denaliCanonicalPathMap.generated.ts"));
  console.log(" -", join(GENERATED_DIR, "denaliConditionallyRequiredPaths.generated.ts"));
  console.log(" -", SCHEMA_GENERATED);
}

main();
