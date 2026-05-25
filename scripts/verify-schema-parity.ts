#!/usr/bin/env npx tsx
/**
 * Diagnostic: compare registry-derived canonical Zod shape vs production
 * `denaliCanonicalTourSchema`.
 *
 * Does not modify production schemas or run in CI/build.
 *
 * Run from repo root:
 *   pnpm --dir apps/web exec tsx --tsconfig tsconfig.json ../../scripts/verify-schema-parity.ts
 */

import {
  DENALI_CANONICAL_CATEGORY_VALUES,
  DENALI_CANONICAL_DURATION_VALUES,
  DENALI_CANONICAL_TRANSPORT_MODE_VALUES,
} from "@repo/types/denali";
import { z } from "zod";

import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "../apps/web/src/features/tours/models/tours-new-validation-messages";
import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
  type DenaliZodFieldKind,
} from "../apps/web/src/features/tours/wizard/denali/registry/denaliFieldRegistryData";
import { denaliGearItemSchema } from "../apps/web/src/features/tours/wizard/schemas/denaliGearItemSchema";
import {
  denaliCanonicalItineraryDayRowSchema,
  optionalApproximateReturnTimeSchema,
} from "../apps/web/src/features/tours/wizard/schemas/denaliItineraryDaySchema";
import { denaliLocationDataSchema } from "../apps/web/src/features/tours/wizard/schemas/denaliLocationDataSchema";
import { denaliCanonicalTourSchema } from "../apps/web/src/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isParsableIsoDateTime(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed));
}

const denaliCanonicalCategorySchema = z.enum(DENALI_CANONICAL_CATEGORY_VALUES);
const denaliCanonicalDurationSchema = z.enum(DENALI_CANONICAL_DURATION_VALUES);
const denaliCanonicalTransportModeSchema = z.enum(DENALI_CANONICAL_TRANSPORT_MODE_VALUES);

const denaliCanonicalGearItemSchema = denaliGearItemSchema.extend({
  id: z.string().regex(UUID_V4, "شناسه تجهیزات معتبر نیست."),
});

const denaliCanonicalPhotoSchema = z
  .object({
    id: z.string().regex(UUID_V4),
    url: z.string().url(),
    filename: z.string().trim().min(1),
    size: z.number().int().min(0).max(5 * 1024 * 1024),
    mimeType: z.string().regex(/^image\/(jpeg|png|webp)$/),
    uploadedAt: z.string().trim().refine(isParsableIsoDateTime),
  })
  .strict();

const denaliCanonicalGatheringPointRowSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().default(""),
    time: z.string().optional(),
    location: denaliLocationDataSchema,
  })
  .strict();

/** Registry zodKind → canonical-field Zod (mirrors denaliCanonicalTourSchema.ts). */
function zodForCanonicalKind(kind: DenaliZodFieldKind): z.ZodTypeAny {
  switch (kind) {
    case "title":
      return z
        .string()
        .trim()
        .min(TOUR_TITLE_MIN_LENGTH)
        .max(TOUR_TITLE_MAX_LENGTH);
    case "tourType":
      return denaliCanonicalCategorySchema;
    case "publishStatus":
      return z.enum(["draft", "active"]).optional();
    case "destinationId":
      return z.string().regex(UUID_V4);
    case "isoDateTime":
      return z.string().trim().refine(isParsableIsoDateTime);
    case "isoDateTimeOptional":
      return z.string().trim().optional().refine(
        (v) => v == null || v === "" || isParsableIsoDateTime(v),
      );
    case "capacityMax":
      return z.number().int().min(1).optional();
    case "optionalInt":
      return z.number().int().min(0).optional();
    case "optionalPositiveInt":
      return z.number().int().min(1).optional();
    case "stringOptional":
      return z.string().trim().optional();
    case "stringArrayDefault":
      return z.array(z.string().regex(UUID_V4)).default([]);
    case "booleanOptional":
      return z.boolean().optional();
    case "socialMediaLink":
      return z.string().trim().max(2048).optional();
    case "approximateReturnTime":
      return optionalApproximateReturnTimeSchema();
    case "difficultyLevel":
      return z.number().min(1).max(10).default(5);
    case "itinerary":
      return z.array(denaliCanonicalItineraryDayRowSchema).optional();
    case "locationData":
      return denaliLocationDataSchema.optional();
    case "gatheringPoints":
      return z.array(denaliCanonicalGatheringPointRowSchema).optional();
    case "gearItems":
      return z.array(denaliCanonicalGearItemSchema).optional();
    case "transportMode":
      return denaliCanonicalTransportModeSchema;
    case "adminCapacityApproval":
      return z.boolean().optional();
    case "photos":
      return z.array(denaliCanonicalPhotoSchema).max(10).optional();
    case "paymentMode":
      return z.enum(["offline_receipt"]);
    case "fitnessLevel":
      return z.enum(["low", "medium", "high"]).optional();
    case "minRequiredPeaks":
      return z.number().int().min(1).max(4).optional();
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function zodForRegistryField(def: DenaliFieldDefinition): z.ZodTypeAny {
  if (def.canonicalPath === "category") {
    return denaliCanonicalCategorySchema;
  }
  if (def.canonicalPath === "duration") {
    return denaliCanonicalDurationSchema;
  }
  if (def.canonicalPath === "transport.mode") {
    return denaliCanonicalTransportModeSchema;
  }
  if (def.canonicalPath === "transport.transportCost") {
    return z.number().int().min(1).optional();
  }
  if (def.canonicalPath === "transport.dongAmount") {
    return z.number().int().min(1).optional();
  }
  if (def.canonicalPath === "transport.seatPreference") {
    return z.enum(["window", "aisle", "any"]).optional();
  }
  if (def.canonicalPath === "program.themeIds") {
    return z.array(z.string().regex(UUID_V4)).default([]);
  }
  if (def.canonicalPath === "program.shortDescription") {
    return z.string().trim().min(1);
  }
  if (def.canonicalPath === "pricing.paymentMode") {
    return z.enum(["offline_receipt"]);
  }
  if (def.canonicalPath === "pricing.basePricePerPerson") {
    return z.number().int().min(1).optional();
  }
  return zodForCanonicalKind(def.zodKind);
}

type ShapeTree = {
  fields: Map<string, z.ZodTypeAny>;
  children: Map<string, ShapeTree>;
};

function emptyTree(): ShapeTree {
  return { fields: new Map(), children: new Map() };
}

function insertField(tree: ShapeTree, canonicalPath: string, fieldSchema: z.ZodTypeAny): void {
  const parts = canonicalPath.split(".");
  let node = tree;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const segment = parts[i]!;
    let child = node.children.get(segment);
    if (!child) {
      child = emptyTree();
      node.children.set(segment, child);
    }
    node = child;
  }
  const leaf = parts[parts.length - 1]!;
  node.fields.set(leaf, fieldSchema);
}

function compileTree(tree: ShapeTree, strict: boolean): z.ZodObject {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, schema] of tree.fields) {
    shape[key] = schema;
  }
  for (const [key, child] of tree.children) {
    shape[key] = compileTree(child, true);
  }
  const obj = z.object(shape);
  return strict ? obj.strict() : obj;
}

const NESTED_STRICT_SECTIONS = new Set([
  "program",
  "transport",
  "pricing",
  "participants",
  "policies",
]);

/**
 * Builds a Zod object schema from {@link DENALI_FIELD_DEFINITIONS} using canonical paths
 * (same nesting as {@link denaliCanonicalTourSchema}).
 */
export function generateSchemaFromRegistry(): z.ZodObject {
  const root = emptyTree();

  for (const def of DENALI_FIELD_DEFINITIONS) {
    insertField(root, def.canonicalPath, zodForRegistryField(def));
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, schema] of root.fields) {
    shape[key] = schema;
  }
  for (const [key, child] of root.children) {
    const strict = NESTED_STRICT_SECTIONS.has(key);
    shape[key] = compileTree(child, strict);
  }

  return z.object(shape);
}

// --- Zod introspection for deep shape comparison ---

type ZodDefLike = {
  type?: string;
  schema?: z.ZodTypeAny;
  innerType?: z.ZodTypeAny;
  in?: z.ZodTypeAny;
  out?: z.ZodTypeAny;
  element?: z.ZodTypeAny;
};

function unwrapZodType(schema: z.ZodTypeAny | undefined): z.ZodTypeAny {
  if (schema == null) {
    throw new Error("unwrapZodType: received undefined schema");
  }
  let cur: z.ZodTypeAny = schema;
  for (let guard = 0; guard < 32; guard += 1) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodDefault || cur instanceof z.ZodNullable) {
      cur = (cur as z.ZodOptional | z.ZodDefault | z.ZodNullable)._def.innerType as z.ZodTypeAny;
      continue;
    }
    const def = cur._def as ZodDefLike;
    if (
      (def.type === "optional" || def.type === "default" || def.type === "nullable") &&
      def.innerType
    ) {
      cur = def.innerType;
      continue;
    }
    if (def.type === "pipe" && def.in) {
      cur = def.in;
      continue;
    }
    if ((def.type === "effects" || def.type === "refinement") && def.schema) {
      cur = def.schema;
      continue;
    }
    break;
  }
  return cur;
}

function getZodArrayElement(schema: z.ZodArray): z.ZodTypeAny {
  const withElement = schema as z.ZodArray & { element?: z.ZodTypeAny };
  return withElement.element ?? (schema._def as ZodDefLike).element!;
}

function isOptionalZod(schema: z.ZodTypeAny): boolean {
  let cur: z.ZodTypeAny = schema;
  for (let guard = 0; guard < 16; guard += 1) {
    if (cur instanceof z.ZodOptional || cur instanceof z.ZodDefault || cur instanceof z.ZodNullable) {
      return true;
    }
    const def = cur._def as ZodDefLike;
    if (def.type === "optional" || def.type === "default" || def.type === "nullable") {
      return true;
    }
    if (def.type === "pipe" && def.in) {
      cur = def.in;
      continue;
    }
    if ((def.type === "effects" || def.type === "refinement") && def.schema) {
      cur = def.schema;
      continue;
    }
    break;
  }
  return false;
}

function describeZodType(schema: z.ZodTypeAny): string {
  const optional = isOptionalZod(schema);
  const base = describeZodTypeCore(unwrapZodType(schema));
  return optional ? `${base}?` : base;
}

function describeZodTypeCore(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) {
    return "string";
  }
  if (schema instanceof z.ZodNumber) {
    return "number";
  }
  if (schema instanceof z.ZodBoolean) {
    return "boolean";
  }
  if (schema instanceof z.ZodEnum) {
    const values = schema.options as readonly string[];
    return `enum(${values.join("|")})`;
  }
  if (schema instanceof z.ZodLiteral) {
    return `literal(${String(schema.value)})`;
  }
  if (schema instanceof z.ZodArray) {
    const inner = unwrapZodType(getZodArrayElement(schema));
    if (inner instanceof z.ZodObject) {
      return "array<object>";
    }
    return `array<${describeZodTypeCore(inner)}>`;
  }
  if (schema instanceof z.ZodObject) {
    return "object";
  }
  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options as z.ZodTypeAny[];
    const parts = options.map((o) => describeZodTypeCore(unwrapZodType(o)));
    return `union(${parts.join(",")})`;
  }
  const typeName = (schema._def as { typeName?: string }).typeName ?? schema.constructor.name;
  return typeName;
}

function resolveObjectRoot(schema: z.ZodTypeAny): z.ZodObject {
  let cur = schema;
  for (let guard = 0; guard < 16; guard += 1) {
    const unwrapped = unwrapZodType(cur);
    if (unwrapped instanceof z.ZodObject) {
      return unwrapped;
    }
    const def = cur._def as { typeName?: string; schema?: z.ZodTypeAny };
    if (def.typeName === "ZodEffects" && def.schema) {
      cur = def.schema;
      continue;
    }
    break;
  }
  throw new Error("Expected Zod object schema at root");
}

function collectFieldDescriptors(
  schema: z.ZodTypeAny,
  prefix = "",
  out = new Map<string, string>(),
): Map<string, string> {
  const obj = unwrapZodType(schema);
  if (!(obj instanceof z.ZodObject)) {
    if (prefix) {
      out.set(prefix, describeZodType(schema));
    }
    return out;
  }

  const shape = obj.shape as Record<string, z.ZodTypeAny>;
  for (const [key, child] of Object.entries(shape)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const inner = unwrapZodType(child);
    if (inner instanceof z.ZodObject) {
      collectFieldDescriptors(child, path, out);
    } else if (inner instanceof z.ZodArray) {
      out.set(path, describeZodType(child));
      const element = unwrapZodType(getZodArrayElement(inner));
      if (element instanceof z.ZodObject) {
        collectFieldDescriptors(element, `${path}[]`, out);
      }
    } else {
      out.set(path, describeZodType(child));
    }
  }
  return out;
}

/** Registry-only canonical paths allowed to be absent from production submit schema. */
const REGISTRY_AHEAD_ALLOWLIST = new Set([
  "eventVariant",
  "transport.seatPreference",
]);

interface ParityMismatch {
  path: string;
  kind: "TYPE_MISMATCH" | "MISSING_IN_REGISTRY" | "MISSING_IN_PROD_SCHEMA";
  registryType?: string;
  productionType?: string;
}

function isBlockingMismatch(m: ParityMismatch): boolean {
  if (m.kind === "TYPE_MISMATCH" || m.kind === "MISSING_IN_REGISTRY") {
    return true;
  }
  if (m.kind === "MISSING_IN_PROD_SCHEMA") {
    return !REGISTRY_AHEAD_ALLOWLIST.has(m.path);
  }
  return false;
}

function partitionMismatches(mismatches: ParityMismatch[]): {
  blocking: ParityMismatch[];
  registryAhead: ParityMismatch[];
} {
  const blocking: ParityMismatch[] = [];
  const registryAhead: ParityMismatch[] = [];
  for (const m of mismatches) {
    if (isBlockingMismatch(m)) {
      blocking.push(m);
    } else if (
      m.kind === "MISSING_IN_PROD_SCHEMA" &&
      REGISTRY_AHEAD_ALLOWLIST.has(m.path)
    ) {
      registryAhead.push(m);
    }
  }
  return { blocking, registryAhead };
}

function compareDescriptorMaps(
  registryMap: Map<string, string>,
  productionMap: Map<string, string>,
): ParityMismatch[] {
  const mismatches: ParityMismatch[] = [];
  const allPaths = new Set([...registryMap.keys(), ...productionMap.keys()]);

  for (const path of [...allPaths].sort()) {
    const reg = registryMap.get(path);
    const prod = productionMap.get(path);

    if (reg == null && prod != null) {
      mismatches.push({
        path,
        kind: "MISSING_IN_REGISTRY",
        productionType: prod,
      });
      continue;
    }
    if (reg != null && prod == null) {
      mismatches.push({
        path,
        kind: "MISSING_IN_PROD_SCHEMA",
        registryType: reg,
      });
      continue;
    }
    if (reg != null && prod != null && reg !== prod) {
      mismatches.push({
        path,
        kind: "TYPE_MISMATCH",
        registryType: reg,
        productionType: prod,
      });
    }
  }

  return mismatches;
}

function printMismatchRows(kind: ParityMismatch["kind"], rows: ParityMismatch[]): void {
  if (rows.length === 0) return;
  console.log(`--- ${kind} (${rows.length}) ---`);
  for (const row of rows) {
    if (kind === "TYPE_MISMATCH") {
      console.log(`  ${row.path}`);
      console.log(`    registry:   ${row.registryType}`);
      console.log(`    production: ${row.productionType}`);
    } else if (kind === "MISSING_IN_REGISTRY") {
      console.log(`  ${row.path}  (production: ${row.productionType})`);
    } else {
      console.log(`  ${row.path}  (registry: ${row.registryType})`);
    }
  }
  console.log("");
}

function printReport(blocking: ParityMismatch[], registryAhead: ParityMismatch[]): void {
  console.log("\n=== Denali canonical schema parity report ===\n");
  console.log(`Registry fields (definitions): ${DENALI_FIELD_DEFINITIONS.length}`);
  console.log(`Blocking issues:               ${blocking.length}`);
  console.log(`Registry-ahead (allowed):      ${registryAhead.length}\n`);

  if (blocking.length === 0 && registryAhead.length === 0) {
    console.log("OK — registry-generated shape matches production field types.\n");
    return;
  }

  if (blocking.length > 0) {
    console.log("=== Blocking drift (fail gate) ===\n");
    printMismatchRows(
      "TYPE_MISMATCH",
      blocking.filter((m) => m.kind === "TYPE_MISMATCH"),
    );
    printMismatchRows(
      "MISSING_IN_REGISTRY",
      blocking.filter((m) => m.kind === "MISSING_IN_REGISTRY"),
    );
    printMismatchRows(
      "MISSING_IN_PROD_SCHEMA",
      blocking.filter((m) => m.kind === "MISSING_IN_PROD_SCHEMA"),
    );
  }

  if (registryAhead.length > 0) {
    console.log("=== Registry-ahead (allowlisted) ===\n");
    printMismatchRows("MISSING_IN_PROD_SCHEMA", registryAhead);
  }

  if (blocking.length === 0 && registryAhead.length > 0) {
    console.log(
      "PASS (registry ahead of production) — only allowlisted fields differ from production schema.\n",
    );
  }
}

function main(): void {
  const generated = generateSchemaFromRegistry();
  const registryMap = collectFieldDescriptors(generated);
  const productionMap = collectFieldDescriptors(denaliCanonicalTourSchema);

  console.log(`Registry-derived schema paths: ${registryMap.size}`);
  console.log(`Production schema paths:      ${productionMap.size}`);

  const mismatches = compareDescriptorMaps(registryMap, productionMap);
  const { blocking, registryAhead } = partitionMismatches(mismatches);
  printReport(blocking, registryAhead);

  if (blocking.length > 0) {
    console.error("\nARCHITECTURAL_DRIFT_DETECTED");
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

const invokedAsScript = process.argv[1]?.includes("verify-schema-parity");
if (invokedAsScript) {
  main();
}
