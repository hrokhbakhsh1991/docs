import {
  resolveExposureCatalogFieldsInSelectedOrder,
  type ExposureCatalogField,
} from "./exposure-field-selection";

const FIELD_PLACEHOLDER_IN_LINE = /\{\{field:([^}]+)\}\}/;

type LegacyFieldDecorations = Readonly<Record<string, { readonly prefix: string }>>;

function parseLegacyFieldDecorations(raw: unknown): LegacyFieldDecorations {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const parsed: Record<string, { prefix: string }> = {};
  for (const [fieldId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    const prefix = (value as Record<string, unknown>).prefix;
    if (typeof prefix !== "string") {
      continue;
    }
    const trimmed = prefix.trim();
    if (trimmed.length > 0) {
      parsed[fieldId] = { prefix: trimmed };
    }
  }
  return parsed;
}

export function exposureCatalogFieldLabel(field: ExposureCatalogField): string {
  return field.adminLabel ?? field.id;
}

export function buildTelegramFieldTemplateLine(field: ExposureCatalogField): string {
  return `${exposureCatalogFieldLabel(field)}: {{field:${field.id}}}`;
}

function templateContainsFieldPlaceholder(template: string, fieldId: string): boolean {
  const pattern = new RegExp(`\\{\\{field:${escapeRegExp(fieldId)}\\}\\}`);
  return pattern.test(template);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendTelegramFieldTemplateLine(template: string, line: string): string {
  const trimmed = template.trimEnd();
  if (trimmed.length === 0) {
    return line;
  }
  return `${trimmed}\n${line}`;
}

function removeTelegramFieldTemplateLine(template: string, fieldId: string): string {
  const lines = template.split("\n");
  const filtered = lines.filter((line) => {
    const match = line.match(FIELD_PLACEHOLDER_IN_LINE);
    return match?.[1]?.trim() !== fieldId;
  });
  return filtered.join("\n").trimEnd();
}

function buildTelegramTemplateFromSelectedFields(
  fields: readonly ExposureCatalogField[],
  selectedFieldIds: readonly string[],
): string {
  return resolveExposureCatalogFieldsInSelectedOrder(fields, selectedFieldIds)
    .map((field) => buildTelegramFieldTemplateLine(field))
    .join("\n");
}

/**
 * One-time migration: legacy `fieldDecorations` prefixes become inline template text.
 */
function migrateTelegramTemplateFromDecorations(input: {
  readonly template: string;
  readonly legacyFieldDecorations?: unknown;
  readonly fields: readonly ExposureCatalogField[];
  readonly selectedFieldIds: readonly string[];
}): string {
  if (input.template.trim().length > 0) {
    return input.template;
  }
  const fieldDecorations = parseLegacyFieldDecorations(input.legacyFieldDecorations);
  if (Object.keys(fieldDecorations).length === 0) {
    return "";
  }

  const orderedFields = resolveExposureCatalogFieldsInSelectedOrder(
    input.fields,
    input.selectedFieldIds,
  );
  const lines = orderedFields.map((field) => {
    const prefix = fieldDecorations[field.id]?.prefix?.trim();
    const label = exposureCatalogFieldLabel(field);
    const placeholder = `{{field:${field.id}}}`;
    if (prefix !== undefined && prefix.length > 0) {
      return `${prefix} ${label}: ${placeholder}`;
    }
    return `${label}: ${placeholder}`;
  });
  return lines.join("\n");
}

export function hydrateTelegramTemplateState(input: {
  readonly template: string;
  readonly legacyFieldDecorations?: unknown;
  readonly fields: readonly ExposureCatalogField[];
  readonly selectedFieldIds: readonly string[];
  readonly customizeFields?: boolean;
}): string {
  const trimmed = input.template.trim();
  if (trimmed.length > 0) {
    return input.template;
  }

  const migrated = migrateTelegramTemplateFromDecorations({
    template: input.template,
    legacyFieldDecorations: input.legacyFieldDecorations,
    fields: input.fields,
    selectedFieldIds: input.selectedFieldIds,
  });
  if (migrated.length > 0) {
    return migrated;
  }

  if (input.customizeFields === true && input.selectedFieldIds.length > 0) {
    const seeded = buildTelegramTemplateFromSelectedFields(input.fields, input.selectedFieldIds);
    if (seeded.length > 0) {
      return seeded;
    }
  }

  return "";
}

export type TelegramDeliveryPreviewLabels = {
  readonly empty: string;
  readonly defaultPrefix: string;
  readonly sampleValue: string;
  readonly aggregateId: string;
  readonly redacted: string;
};

function resolvePreviewSampleValue(field: ExposureCatalogField, fallback: string): string {
  const key = `${field.id} ${field.canonicalPath}`.toLowerCase();
  if (key.includes("title") || key.includes("name")) {
    return "تور کویر لوت";
  }
  if (key.includes("date") || key.includes("time")) {
    return "۱۴۰۳/۰۸/۲۰";
  }
  if (key.includes("price") || key.includes("amount")) {
    return "۴۸٬۰۰۰٬۰۰۰ تومان";
  }
  if (key.includes("location") || key.includes("destination")) {
    return "کرمان";
  }
  return fallback;
}

/** Client preview renderer — mirrors worker automatic vs custom template branches. */
export function renderTelegramDeliveryPreview(input: {
  readonly eventLabel: string;
  readonly fields: readonly ExposureCatalogField[];
  readonly selectedFieldIds: readonly string[];
  readonly template: string;
  readonly labels: TelegramDeliveryPreviewLabels;
}): string {
  const selectedFields = resolveExposureCatalogFieldsInSelectedOrder(
    input.fields,
    input.selectedFieldIds,
  );
  if (selectedFields.length === 0) {
    return input.labels.empty;
  }

  const sampleById = new Map(
    selectedFields.map(
      (field) =>
        [field.id, resolvePreviewSampleValue(field, input.labels.sampleValue)] as const,
    ),
  );
  const trimmedTemplate = input.template.trim();
  if (trimmedTemplate.length > 0) {
    return trimmedTemplate
      .replaceAll("{{eventType}}", input.eventLabel)
      .replaceAll("{{aggregateId}}", input.labels.aggregateId)
      .replace(/{{field:([^}]+)}}/g, (_match, fieldId: string) => {
        return sampleById.get(fieldId.trim()) ?? input.labels.redacted;
      });
  }

  const lines = selectedFields.map((field) => {
    const label = exposureCatalogFieldLabel(field);
    const value = resolvePreviewSampleValue(field, input.labels.sampleValue);
    return `${label}: ${value}`;
  });
  return `${input.labels.defaultPrefix}: ${input.eventLabel}\n${lines.join("\n")}`;
}

export function syncTelegramTemplateOnFieldToggle(input: {
  readonly template: string;
  readonly field: ExposureCatalogField;
  readonly checked: boolean;
}): string {
  if (input.checked) {
    if (templateContainsFieldPlaceholder(input.template, input.field.id)) {
      return input.template;
    }
    return appendTelegramFieldTemplateLine(
      input.template,
      buildTelegramFieldTemplateLine(input.field),
    );
  }

  return removeTelegramFieldTemplateLine(input.template, input.field.id);
}
