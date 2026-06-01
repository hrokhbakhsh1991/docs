import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

type ErrorType = "GHOST" | "MISSING" | "TYPE";

type LedgerEntry = {
  templateId: string;
  fieldPath: string;
  errorType: ErrorType;
  expectedValueType: string;
  actualValueType: string;
};

type MemoryTracker = {
  entries: LedgerEntry[];
  unknownSchemaPaths: Set<string>;
};

function schemaDef(schema: z.ZodTypeAny): ZodDef {
  return (schema as unknown as { _def?: ZodDef })._def ?? {};
}

function schemaType(schema: z.ZodTypeAny): string {
  return schemaDef(schema).type ?? "";
}

function expectedTypeLabel(schema: z.ZodTypeAny): string {
  const t = schemaType(schema);
  const def = schemaDef(schema);
  if (t === "enum" && Array.isArray(def.values)) {
    return `enum(${def.values.join("|")})`;
  }
  if (t === "nativeEnum" && def.values != null && !Array.isArray(def.values)) {
    return `native-enum(${Object.values(def.values).join("|")})`;
  }
  if (t === "literal") {
    return `literal(${String(def.value)})`;
  }
  return t || "unknown";
}

function actualTypeLabel(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
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

function track(
  tracker: MemoryTracker,
  templateId: string,
  fieldPath: string,
  errorType: ErrorType,
  expectedValueType: string,
  actualValueType: string,
): void {
  tracker.entries.push({
    templateId,
    fieldPath,
    errorType,
    expectedValueType,
    actualValueType,
  });
  if (errorType === "GHOST") {
    tracker.unknownSchemaPaths.add(fieldPath);
  }
}

function assertPrimitiveType(
  tracker: MemoryTracker,
  templateId: string,
  path: string,
  value: unknown,
  schema: z.ZodTypeAny,
): void {
  const t = schemaType(schema);
  const def = schemaDef(schema);

  if (t === "string" && typeof value !== "string") {
    track(tracker, templateId, path, "TYPE", "string", actualTypeLabel(value));
  }
  if (t === "number" && typeof value !== "number") {
    track(tracker, templateId, path, "TYPE", "number", actualTypeLabel(value));
  }
  if (t === "boolean" && typeof value !== "boolean") {
    track(tracker, templateId, path, "TYPE", "boolean", actualTypeLabel(value));
  }
  if (t === "date" && !(value instanceof Date) && typeof value !== "string") {
    track(tracker, templateId, path, "TYPE", "date-string", actualTypeLabel(value));
  }
  if (t === "literal") {
    if (value !== def.value) {
      track(
        tracker,
        templateId,
        path,
        "TYPE",
        expectedTypeLabel(schema),
        JSON.stringify(value),
      );
    }
  }
  if (t === "enum" && Array.isArray(def.values)) {
    const expectedValues = def.values.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (typeof value !== "string" || !expectedValues.includes(value)) {
      track(
        tracker,
        templateId,
        path,
        "TYPE",
        expectedTypeLabel(schema),
        JSON.stringify(value),
      );
    }
  }
  if (t === "nativeEnum" && def.values != null && !Array.isArray(def.values)) {
    const enumValues = Object.values(def.values).filter(
      (entry): entry is string | number => typeof entry === "string" || typeof entry === "number",
    );
    if (!enumValues.includes(value as string | number)) {
      track(
        tracker,
        templateId,
        path,
        "TYPE",
        expectedTypeLabel(schema),
        JSON.stringify(value),
      );
    }
  }
}

function validateNode(
  tracker: MemoryTracker,
  templateId: string,
  value: unknown,
  schema: z.ZodTypeAny,
  path: string,
): void {
  const { schema: unwrapped, required, nullable } = unwrapSchema(schema);
  const t = schemaType(unwrapped);
  const def = schemaDef(unwrapped);

  if (value === undefined) {
    if (required) {
      track(
        tracker,
        templateId,
        path,
        "MISSING",
        expectedTypeLabel(unwrapped),
        "undefined",
      );
    }
    return;
  }

  if (value === null) {
    if (!nullable) {
      track(
        tracker,
        templateId,
        path,
        "MISSING",
        expectedTypeLabel(unwrapped),
        "null",
      );
    }
    return;
  }

  if (t === "object") {
    if (!isPlainObject(value)) {
      track(
        tracker,
        templateId,
        path,
        "TYPE",
        "object",
        actualTypeLabel(value),
      );
      return;
    }
    const shape = def.shape ?? {};
    for (const key of Object.keys(value)) {
      if (!(key in shape)) {
        const ghostPath = path === "<root>" ? key : `${path}.${key}`;
        track(tracker, templateId, ghostPath, "GHOST", "schema-path", actualTypeLabel(value[key]));
      }
    }
    for (const [key, childSchema] of Object.entries(shape)) {
      const nextPath = path === "<root>" ? key : `${path}.${key}`;
      validateNode(tracker, templateId, value[key], childSchema, nextPath);
    }
    return;
  }

  if (t === "array") {
    if (!Array.isArray(value)) {
      track(
        tracker,
        templateId,
        path,
        "TYPE",
        "array",
        actualTypeLabel(value),
      );
      return;
    }
    const element = def.element;
    if (element == null) {
      track(tracker, templateId, path, "TYPE", "array-element-schema", "missing");
      return;
    }
    value.forEach((item, index) => {
      validateNode(tracker, templateId, item, element, `${path}[${index}]`);
    });
    return;
  }

  if (t === "record") {
    if (!isPlainObject(value)) {
      track(
        tracker,
        templateId,
        path,
        "TYPE",
        "record",
        actualTypeLabel(value),
      );
      return;
    }
    const valueType = def.valueType;
    if (valueType == null) {
      track(tracker, templateId, path, "TYPE", "record-value-schema", "missing");
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      validateNode(tracker, templateId, child, valueType, `${path}.${key}`);
    }
    return;
  }

  assertPrimitiveType(tracker, templateId, path, value, unwrapped);
}

function auditCanonicalDataAgainstSchema(
  tracker: MemoryTracker,
  templateId: string,
  canonicalData: unknown,
  schema: z.ZodType<DenaliCreateTourWizardForm>,
): void {
  if (!isPlainObject(canonicalData)) {
    track(
      tracker,
      templateId,
      "<root>",
      "TYPE",
      "object",
      actualTypeLabel(canonicalData),
    );
    return;
  }
  validateNode(tracker, templateId, canonicalData, schema, "<root>");
}

function toMarkdownTable(entries: LedgerEntry[]): string[] {
  const lines: string[] = [];
  lines.push("| TemplateID | FieldPath | ErrorType | ExpectedValueType | ActualValueType |");
  lines.push("|---|---|---|---|---|");
  for (const entry of entries) {
    lines.push(
      `| \`${entry.templateId}\` | \`${entry.fieldPath}\` | \`${entry.errorType}\` | \`${entry.expectedValueType}\` | \`${entry.actualValueType}\` |`,
    );
  }
  return lines;
}

function buildComplianceSection(source: string): string[] {
  const structuralMirrorRemoved = !source.includes("DenaliCanonicalStructuralMirror");
  const noRhfTopLevelReturn =
    !/return\s*\{[\s\S]*?\bbasicInfo\s*:/.test(source) &&
    !/return\s*\{[\s\S]*?\bprogramNature\s*:/.test(source);
  const noHardcodedKeyLists = !/\b(BASIC_INFO_KEYS|PROGRAM_NATURE_KEYS|TRANSPORT_KEYS)\s*=/.test(
    source,
  );
  const compliant =
    structuralMirrorRemoved && noRhfTopLevelReturn && noHardcodedKeyLists;
  const lines: string[] = [];
  lines.push("## Code Compliance Check");
  lines.push("");
  lines.push(
    `- canonical-only output (no RHF structural mirror): ${structuralMirrorRemoved ? "COMPLIANT" : "NON-COMPLIANT"}`,
  );
  lines.push(
    `- serializer return shape (flat canonical, not nested form keys): ${noRhfTopLevelReturn ? "COMPLIANT" : "NON-COMPLIANT"}`,
  );
  lines.push(
    `- no hardcoded section key-list arrays in adapter: ${noHardcodedKeyLists ? "COMPLIANT" : "NON-COMPLIANT"}`,
  );
  lines.push("");
  if (!compliant) {
    lines.push("NON-COMPLIANT serializer detected in denaliCanonicalFromForm.");
    lines.push("");
  }
  return lines;
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

    const tracker: MemoryTracker = {
      entries: [],
      unknownSchemaPaths: new Set<string>(),
    };

    for (const row of rows) {
      auditCanonicalDataAgainstSchema(
        tracker,
        row.id,
        row.canonical_data,
        denaliTourCreateBaseSchema as z.ZodType<DenaliCreateTourWizardForm>,
      );
    }

    const templatePath = resolve(
      process.cwd(),
      "../../packages/types/src/denali/denaliCanonicalFromForm.ts",
    );
    const serializerSource = readFileSync(templatePath, "utf8");

    const reportLines: string[] = [];
    reportLines.push("# Final Integrity Report");
    reportLines.push("");
    reportLines.push("## Audit Command");
    reportLines.push("");
    reportLines.push("`cd apps/api && pnpm exec tsx src/scripts/audit-structural-integrity.ts`");
    reportLines.push("");
    reportLines.push("## Summary");
    reportLines.push("");
    reportLines.push(`- Templates scanned: ${rows.length}`);
    reportLines.push(`- Total discrepancies: ${tracker.entries.length}`);
    reportLines.push(`- GHOST count: ${tracker.entries.filter((e) => e.errorType === "GHOST").length}`);
    reportLines.push(`- MISSING count: ${tracker.entries.filter((e) => e.errorType === "MISSING").length}`);
    reportLines.push(`- TYPE count: ${tracker.entries.filter((e) => e.errorType === "TYPE").length}`);
    reportLines.push("");
    reportLines.push("## Full Discrepancy Ledger");
    reportLines.push("");
    if (tracker.entries.length === 0) {
      reportLines.push("NO DRIFT DETECTED");
      reportLines.push("");
    } else {
      reportLines.push(...toMarkdownTable(tracker.entries));
      reportLines.push("");
    }
    reportLines.push("## Unknown DB Paths (not in RHF Schema)");
    reportLines.push("");
    const unknownPaths = [...tracker.unknownSchemaPaths].sort((a, b) => a.localeCompare(b));
    if (unknownPaths.length === 0) {
      reportLines.push("- (none)");
    } else {
      for (const path of unknownPaths) {
        reportLines.push(`- \`${path}\``);
      }
    }
    reportLines.push("");
    reportLines.push(...buildComplianceSection(serializerSource));

    const reportPath = resolve(process.cwd(), "../../final-integrity-report.md");
    writeFileSync(reportPath, `${reportLines.join("\n")}\n`, "utf8");

    process.stdout.write(`Wrote ${reportPath}\n`);
    process.stdout.write(`Scanned templates=${rows.length}, discrepancies=${tracker.entries.length}\n`);
    if (tracker.entries.length === 0) {
      process.stdout.write("NO DRIFT DETECTED\n");
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
});
