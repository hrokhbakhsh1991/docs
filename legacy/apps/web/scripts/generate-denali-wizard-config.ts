#!/usr/bin/env npx tsx
/**
 * Generates Denali wizard artifacts from `@repo/denali-domain` registry sources.
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
} from "../../../packages/denali-domain/src/registry/denaliRegistryCodegen";
import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliZodFieldKind,
} from "../../../packages/denali-domain/src/registry/denaliFieldRegistryData";
import { DENALI_MATRIX_CELLS } from "../../../packages/denali-domain/src/registry/denaliRuleMatrixRecipes";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  type DenaliRuleSet,
} from "../../../packages/denali-domain/src/rules/denaliRuleModel.types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOMAIN_SRC = join(__dirname, "../../../packages/denali-domain/src");
const GENERATED_DIR = join(DOMAIN_SRC, "rules/generated");
const SCHEMA_DIR = join(DOMAIN_SRC, "schemas");
const SCHEMA_GENERATED = join(SCHEMA_DIR, "denaliTourCreateBaseSchema.generated.ts");
const SCHEMA_CORE_GENERATED = join(SCHEMA_DIR, "denaliCore.schema.generated.ts");
const SCHEMA_LOGISTICS_GENERATED = join(SCHEMA_DIR, "denaliLogistics.schema.generated.ts");
const SCHEMA_PRICING_GENERATED = join(SCHEMA_DIR, "denaliPricing.schema.generated.ts");

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

type SchemaDomain = "core" | "logistics" | "pricing";

function schemaDomainForRhfPath(rhfPath: string): SchemaDomain {
  if (rhfPath.startsWith("transport.")) return "logistics";
  if (rhfPath.startsWith("pricingPayment.")) return "pricing";
  if (rhfPath.startsWith("policies.")) return "pricing";
  if (rhfPath === "participantRequirements.gearItems") return "logistics";
  if (rhfPath.startsWith("participantRequirements.")) return "pricing";
  if (rhfPath.startsWith("tripDetails.logistics.")) return "logistics";
  if (rhfPath === "tripDetails.overview.customServiceLabels") return "logistics";
  if (rhfPath === "tripDetails.overview.nonAttendanceDetails") return "pricing";
  return "core";
}

function buildZodSchemaSlices(): {
  core: string;
  logistics: string;
  pricing: string;
  composer: string;
} {
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

  const overviewByDomain: Record<SchemaDomain, Map<string, string>> = {
    core: new Map(),
    logistics: new Map(),
    pricing: new Map(),
  };

  const participantByDomain: Record<SchemaDomain, Map<string, string>> = {
    core: new Map(),
    logistics: new Map(),
    pricing: new Map(),
  };

  for (const def of DENALI_FIELD_DEFINITIONS) {
    const section = zodSectionForRhfPath(def.rhfPath);
    const key = zodKeyFromRhfPath(def.rhfPath, section);
    const fragment = ZOD_FRAGMENTS[def.zodKind];
    if (!fragment) {
      throw new Error(`Missing Zod fragment for kind ${def.zodKind} (${def.canonicalPath})`);
    }

    if (section === "tripDetails.overview") {
      overviewByDomain[schemaDomainForRhfPath(def.rhfPath)].set(key, fragment);
      continue;
    }

    if (section === "participantRequirements") {
      participantByDomain[schemaDomainForRhfPath(def.rhfPath)].set(key, fragment);
      continue;
    }

    sections[section].set(key, fragment);
  }

  for (const loc of ["startPoint", "summitPoint", "campPoint", "endPoint"]) {
    if (!sections.basicInfo.has(loc)) {
      sections.basicInfo.set(loc, ZOD_FRAGMENTS.locationData);
    }
  }

  function renderObject(name: string, map: Map<string, string>, indent = ""): string {
    const entries = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      return `export const ${name} = z.object({});`;
    }
    const inner = entries
      .map(([key, val]) => `${indent}  ${key}: ${val},`)
      .join("\n");
    return `export const ${name} = z.object({\n${inner}\n${indent}});`;
  }

  const coreImports = `${BANNER}
import { z } from "zod";

import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "../constants/tourTitleLimits";

import {
  denaliImageFileAssetSchema,
  DENALI_MAX_PHOTO_COUNT,
} from "./denaliFileAssetSchema";
import {
  denaliItineraryDayRowSchema,
  optionalApproximateReturnTimeSchema,
} from "./denaliItineraryDaySchema";
import { denaliLocationDataSchema } from "./denaliLocationDataSchema";
import {
  denaliTourKindSchema,
  isParsableIsoDateTime,
  optionalInt,
  optionalPositiveInt,
  rejectZeroAmount,
} from "./denaliSchemaPrimitives";
`;

  const logisticsImports = `${BANNER}
import { z } from "zod";

import { denaliGearItemSchema } from "./denaliGearItemSchema";
import { denaliGatheringPickupStationFormSchema } from "./denaliGatheringPickupStation.schema";
import {
  denaliTransportModeSchema,
  optionalInt,
  rejectZeroAmount,
} from "./denaliSchemaPrimitives";
`;

  const pricingImports = `${BANNER}
import { z } from "zod";

import {
  optionalInt,
  optionalPositiveInt,
  rejectZeroAmount,
} from "./denaliSchemaPrimitives";
`;

  const core = `${coreImports}

${renderObject("denaliBasicInfoSchema", sections.basicInfo)}

${renderObject("denaliProgramNatureSchema", sections.programNature)}

${renderObject("denaliPhotosSchema", sections.photosData)}

${renderObject("denaliTripDetailsMetricsSchema", sections["tripDetails.metrics"])}

${renderObject("denaliTripDetailsOverviewCoreSchema", overviewByDomain.core)}

export function applyDenaliCoreSchemaRefinements(
  data: {
    basicInfo: z.infer<typeof denaliBasicInfoSchema>;
  },
  ctx: z.RefinementCtx,
): void {
  rejectZeroAmount(
    data.basicInfo.capacityMax,
    ctx,
    ["basicInfo", "capacityMax"],
    "حداکثر ظرفیت باید حداقل ۱ باشد.",
  );
}
`;

  const logistics = `${logisticsImports}

${renderObject("denaliTransportSchema", sections.transport)}

${renderObject("denaliTripDetailsOverviewLogisticsSchema", overviewByDomain.logistics)}

${renderObject("denaliParticipantGearSchema", participantByDomain.logistics)}

export const denaliTripDetailsLogisticsSchema = z.object({
  gatheringPoints: z.array(denaliGatheringPickupStationFormSchema).default([]),
}).default({ gatheringPoints: [] });

export function applyDenaliLogisticsSchemaRefinements(
  data: {
    transport: z.infer<typeof denaliTransportSchema>;
  },
  ctx: z.RefinementCtx,
): void {
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
}
`;

  const pricing = `${pricingImports}

${renderObject("denaliPricingPaymentSchema", sections.pricingPayment)}

${renderObject("denaliParticipantRequirementsSchema", participantByDomain.pricing)}

${renderObject("denaliPoliciesSchema", sections.policies)}

${renderObject("denaliTripDetailsOverviewPricingSchema", overviewByDomain.pricing)}

export function applyDenaliPricingSchemaRefinements(
  data: {
    pricingPayment: z.infer<typeof denaliPricingPaymentSchema>;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.pricingPayment.requiresPayment === true) {
    rejectZeroAmount(
      data.pricingPayment.basePricePerPerson,
      ctx,
      ["pricingPayment", "basePricePerPerson"],
      "قیمت باید بیشتر از صفر باشد.",
    );
  }
}
`;

  const composer = `${BANNER}
import { z } from "zod";

import {
  applyDenaliCoreSchemaRefinements,
  denaliBasicInfoSchema,
  denaliPhotosSchema,
  denaliProgramNatureSchema,
  denaliTripDetailsMetricsSchema,
  denaliTripDetailsOverviewCoreSchema,
} from "./denaliCore.schema.generated";
import {
  applyDenaliLogisticsSchemaRefinements,
  denaliParticipantGearSchema,
  denaliTransportSchema,
  denaliTripDetailsLogisticsSchema,
  denaliTripDetailsOverviewLogisticsSchema,
} from "./denaliLogistics.schema.generated";
import {
  applyDenaliPricingSchemaRefinements,
  denaliParticipantRequirementsSchema,
  denaliPoliciesSchema,
  denaliPricingPaymentSchema,
  denaliTripDetailsOverviewPricingSchema,
} from "./denaliPricing.schema.generated";

const denaliTripDetailsOverviewSchema = denaliTripDetailsOverviewCoreSchema
  .merge(denaliTripDetailsOverviewLogisticsSchema)
  .merge(denaliTripDetailsOverviewPricingSchema);

const denaliParticipantRequirementsMergedSchema = denaliParticipantRequirementsSchema.merge(
  denaliParticipantGearSchema,
);

const denaliTourCreateObjectSchema = z.object({
  basicInfo: denaliBasicInfoSchema,
  programNature: denaliProgramNatureSchema,
  transport: denaliTransportSchema,
  pricingPayment: denaliPricingPaymentSchema,
  participantRequirements: denaliParticipantRequirementsMergedSchema,
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

export const denaliTourCreateBaseSchema = denaliTourCreateObjectSchema.superRefine((data, ctx) => {
  applyDenaliCoreSchemaRefinements(data, ctx);
  applyDenaliLogisticsSchemaRefinements(data, ctx);
  applyDenaliPricingSchemaRefinements(data, ctx);
});

export type DenaliCreateTourWizardForm = z.infer<typeof denaliTourCreateBaseSchema>;
`;

  return { core, logistics, pricing, composer };
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
  const schemaSlices = buildZodSchemaSlices();
  writeFileSync(SCHEMA_CORE_GENERATED, schemaSlices.core, "utf8");
  writeFileSync(SCHEMA_LOGISTICS_GENERATED, schemaSlices.logistics, "utf8");
  writeFileSync(SCHEMA_PRICING_GENERATED, schemaSlices.pricing, "utf8");
  writeFileSync(SCHEMA_GENERATED, schemaSlices.composer, "utf8");

}

main();
