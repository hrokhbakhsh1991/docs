import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { denaliTourCreateBaseSchema, type DenaliCreateTourWizardForm } from "@repo/denali-domain";
import { z } from "zod";

function loadEnvFile(relativeName: string): void {
  const envPath = resolve(process.cwd(), relativeName);
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

type TemplateRow = {
  id: string;
  workspace_id: string;
  canonical_data: unknown;
};

type UnwrappedSchema = {
  schema: z.ZodTypeAny;
  required: boolean;
  nullable: boolean;
};

type ZodDef = {
  type?: string;
  innerType?: z.ZodTypeAny;
  schema?: z.ZodTypeAny;
  out?: z.ZodTypeAny;
  shape?: Record<string, z.ZodTypeAny>;
  element?: z.ZodTypeAny;
  values?: Record<string, string | number> | readonly string[];
  value?: unknown;
  valueType?: z.ZodTypeAny;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function failGhost(path: string): never {
  throw new Error(`GHOST_FIELD_LEAK: ${path} found in DB but not in Schema`);
}

function failMissing(path: string): never {
  throw new Error(`MISSING_DATA_LEAK: ${path} missing in DB`);
}

function failType(path: string, expected: string, actual: string): never {
  throw new Error(`TYPE_MISMATCH_LEAK: ${path} expected ${expected}, found ${actual}`);
}

function schemaDef(schema: z.ZodTypeAny): ZodDef {
  return (schema as unknown as { _def?: ZodDef })._def ?? {};
}

function schemaType(schema: z.ZodTypeAny): string {
  return schemaDef(schema).type ?? "";
}

function unwrapSchema(schema: z.ZodTypeAny): UnwrappedSchema {
  let current = schema;
  let required = true;
  let nullable = false;

  for (;;) {
    const t = schemaType(current);
    const def = schemaDef(current);
    if (t === "optional" || t === "default" || t === "catch") {
      required = false;
      if (def.innerType == null) break;
      current = def.innerType;
      continue;
    }
    if (t === "nullable") {
      nullable = true;
      if (def.innerType == null) break;
      current = def.innerType;
      continue;
    }
    if (t === "pipe" && def.out != null) {
      current = def.out;
      continue;
    }
    if ((t === "transform" || t === "effects") && def.schema != null) {
      current = def.schema;
      continue;
    }
    break;
  }

  return { schema: current, required, nullable };
}

function assertPrimitiveType(path: string, value: unknown, schema: z.ZodTypeAny): void {
  const t = schemaType(schema);
  const def = schemaDef(schema);

  if (t === "string" && typeof value !== "string") {
    failType(path, "string", typeof value);
  }
  if (t === "number" && typeof value !== "number") {
    failType(path, "number", typeof value);
  }
  if (t === "boolean" && typeof value !== "boolean") {
    failType(path, "boolean", typeof value);
  }
  if (t === "date" && !(value instanceof Date) && typeof value !== "string") {
    failType(path, "date-string", typeof value);
  }
  if (t === "literal") {
    const expected = String(def.value);
    if (value !== def.value) {
      failType(path, `literal(${expected})`, JSON.stringify(value));
    }
  }
  if (t === "enum" && Array.isArray(def.values)) {
    const expectedValues = def.values.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (typeof value !== "string" || !expectedValues.includes(value)) {
      failType(path, `enum(${expectedValues.join("|")})`, JSON.stringify(value));
    }
  }
  if (t === "nativeEnum" && def.values != null && !Array.isArray(def.values)) {
    const enumValues = Object.values(def.values).filter(
      (entry): entry is string | number => typeof entry === "string" || typeof entry === "number",
    );
    if (!enumValues.includes(value as string | number)) {
      failType(path, `native-enum(${enumValues.join("|")})`, JSON.stringify(value));
    }
  }
}

function validateNode(value: unknown, schema: z.ZodTypeAny, path: string): void {
  const { schema: unwrapped, required, nullable } = unwrapSchema(schema);
  const t = schemaType(unwrapped);
  const def = schemaDef(unwrapped);

  if (value === undefined) {
    if (required) {
      failMissing(path);
    }
    return;
  }

  if (value === null) {
    if (!nullable) {
      failMissing(path);
    }
    return;
  }

  if (t === "object") {
    if (!isPlainObject(value)) {
      failType(path, "object", Array.isArray(value) ? "array" : typeof value);
    }
    const shape = def.shape ?? {};
    for (const key of Object.keys(value)) {
      if (!(key in shape)) {
        failGhost(path === "<root>" ? key : `${path}.${key}`);
      }
    }
    for (const [key, childSchema] of Object.entries(shape)) {
      const nextPath = path === "<root>" ? key : `${path}.${key}`;
      validateNode(value[key], childSchema, nextPath);
    }
    return;
  }

  if (t === "array") {
    if (!Array.isArray(value)) {
      failType(path, "array", typeof value);
    }
    const element = def.element;
    if (element == null) {
      failType(path, "array-element-schema", "missing");
    }
    value.forEach((item, index) => {
      validateNode(item, element, `${path}[${index}]`);
    });
    return;
  }

  if (t === "record") {
    if (!isPlainObject(value)) {
      failType(path, "record", Array.isArray(value) ? "array" : typeof value);
    }
    const valueType = def.valueType;
    if (valueType == null) {
      failType(path, "record-value-schema", "missing");
    }
    for (const [key, child] of Object.entries(value)) {
      validateNode(child, valueType, `${path}.${key}`);
    }
    return;
  }

  assertPrimitiveType(path, value, unwrapped);
}

function assertCanonicalDataAgainstSchema(
  canonicalData: unknown,
  schema: z.ZodType<DenaliCreateTourWizardForm>,
): void {
  if (!isPlainObject(canonicalData)) {
    failType("<root>", "object", canonicalData === null ? "null" : typeof canonicalData);
  }
  validateNode(canonicalData, schema, "<root>");
}

async function main(): Promise<void> {
  loadEnvFile(".env");
  loadEnvFile(".env.test");
  const { AppDataSource } = await import("../data-source");

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  try {
    const rows = (await AppDataSource.query(
      `
      SELECT id, workspace_id, canonical_data
      FROM workspace_tour_wizard_templates
      ORDER BY updated_at DESC
      `,
    )) as TemplateRow[];

    for (const row of rows) {
      assertCanonicalDataAgainstSchema(
        row.canonical_data,
        denaliTourCreateBaseSchema as z.ZodType<DenaliCreateTourWizardForm>,
      );
      process.stdout.write(`PASS template=${row.id} workspace=${row.workspace_id}\n`);
    }

    process.stdout.write(`PASS_ALL templates=${rows.length}\n`);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
