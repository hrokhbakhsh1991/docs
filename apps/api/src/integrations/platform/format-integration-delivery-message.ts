import { resolveIntegrationSurfaceForWorkspaceType } from "./resolve-integration-surface";

const FIELD_PLACEHOLDER_PATTERN = /\{\{field:([^}]+)\}\}/g;

// Same locale/timezone convention as enrich-canonical-delivery-payload.ts, applied
// here so raw ISO timestamps in {{...}} placeholders (createdAt, submittedAt, etc.)
// render as readable Tehran-local Persian dates instead of literal ISO strings.
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})/;
const DELIVERY_DATE_TIME_LOCALE = "fa-IR";
const DELIVERY_DATE_TIME_TIME_ZONE = "Asia/Tehran";

function formatPlaceholderDateValue(value: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE_TIME_PATTERN.test(trimmed)) {
    return value;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat(DELIVERY_DATE_TIME_LOCALE, {
    timeZone: DELIVERY_DATE_TIME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(trimmed.includes("T") ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(parsed));
}

function readDeliveryFieldIds(payload: Record<string, unknown>): ReadonlySet<string> | null {
  const raw = payload.integrationDeliveryFieldIds;
  if (!Array.isArray(raw)) {
    return null;
  }
  return new Set(raw.filter((id): id is string => typeof id === "string"));
}

function readDeliveryFieldIdsOrdered(payload: Record<string, unknown>): readonly string[] {
  const raw = payload.integrationDeliveryFieldIds;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === "string");
}

function readDeliveryFieldValues(
  payload: Record<string, unknown>
): Readonly<Record<string, string>> {
  const raw = payload.integrationDeliveryFieldValues;
  if (typeof raw !== "object" || raw === null) {
    return {};
  }
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  return values;
}

function humanizeFieldId(fieldId: string): string {
  const segment = fieldId.split(".").pop() ?? fieldId;
  const withoutIdSuffix = segment.endsWith("Id") ? segment.slice(0, -2) : segment;
  return withoutIdSuffix
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveDeliveryTitle(payload: Record<string, unknown>): string {
  return typeof payload.title === "string" && payload.title.trim().length > 0
    ? payload.title.trim()
    : String(payload.aggregateId ?? payload.tourId ?? "");
}

function resolveDeliveryAggregateId(payload: Record<string, unknown>): string {
  return String(payload.aggregateId ?? payload.tourId ?? "");
}

function applyPayloadPlaceholders(
  template: string,
  payload: Record<string, unknown>,
  eventType: string
): string {
  return template.replace(/\{\{([A-Za-z][A-Za-z0-9_.-]*)\}\}/g, (match, key: string) => {
    if (key === "title") return resolveDeliveryTitle(payload);
    if (key === "aggregateId") return resolveDeliveryAggregateId(payload);
    if (key === "eventType") return eventType;
    const value = payload[key];
    if (typeof value === "string") {
      return formatPlaceholderDateValue(value);
    }
    return typeof value === "number" || typeof value === "boolean" ? String(value) : match;
  });
}

function readDeliveryFieldDecorations(
  payload: Record<string, unknown>
): Readonly<Record<string, { prefix: string }>> {
  const raw = payload.integrationDeliveryFieldDecorations;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  const decorations: Record<string, { prefix: string }> = {};
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
      decorations[fieldId] = { prefix: trimmed };
    }
  }
  return decorations;
}

function renderAutomaticDeliveryFieldLines(payload: Record<string, unknown>): string | null {
  const fieldIds = readDeliveryFieldIdsOrdered(payload);
  if (fieldIds.length === 0) {
    return null;
  }
  const fieldValues = readDeliveryFieldValues(payload);
  const decorations = readDeliveryFieldDecorations(payload);
  const lines: string[] = [];
  for (const fieldId of fieldIds) {
    const value = fieldValues[fieldId]?.trim();
    if (value === undefined || value.length === 0) {
      continue;
    }
    const label = humanizeFieldId(fieldId);
    const prefix = decorations[fieldId]?.prefix;
    lines.push(
      prefix !== undefined && prefix.length > 0
        ? `${prefix} ${label}: ${value}`
        : `${label}: ${value}`
    );
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

async function renderSurfaceHeaderTemplate(input: {
  readonly workspaceType: string | null;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}): Promise<string> {
  const surface = await resolveIntegrationSurfaceForWorkspaceType(input.workspaceType);
  const template = surface?.messageTemplates?.[input.eventType] ?? `${input.eventType}: {{title}}`;
  return template
    .replaceAll("{{title}}", resolveDeliveryTitle(input.payload))
    .replaceAll("{{aggregateId}}", resolveDeliveryAggregateId(input.payload))
    .replaceAll("{{eventType}}", input.eventType);
}

/**
 * Resolves `{{field:<canonicalId>}}` placeholders against delivery-eligible field policy metadata.
 * Non-eligible or absent field ids redact to an empty string — field policy is the only gate.
 */
export async function applyFieldPolicyPlaceholders(
  template: string,
  payload: Record<string, unknown>
): Promise<string> {
  if (!template.includes("{{field:")) {
    return template;
  }
  const eligibleFieldIds = readDeliveryFieldIds(payload);
  const fieldValues = readDeliveryFieldValues(payload);

  return template.replaceAll(FIELD_PLACEHOLDER_PATTERN, (_match, rawId: string) => {
    const fieldId = rawId.trim();
    if (eligibleFieldIds === null || !eligibleFieldIds.has(fieldId)) {
      return "";
    }
    return fieldValues[fieldId] ?? "";
  });
}

export async function formatIntegrationDeliveryMessage(input: {
  readonly workspaceType: string | null;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}): Promise<string> {
  const appendReceiptEvidenceDetails = (message: string): string => {
    if (input.eventType !== "receipt.submitted") {
      return message;
    }
    const evidenceKind =
      typeof input.payload.evidenceKind === "string" ? input.payload.evidenceKind.trim() : "";
    const note = typeof input.payload.note === "string" ? input.payload.note.trim() : "";
    if (evidenceKind.length === 0 && note.length === 0) {
      return message;
    }
    return `${message}\nنوع مدرک: ${evidenceKind || "فایل"}\nتوضیحات: ${note || "بدون توضیحات"}`;
  };
  const overrideTemplate =
    typeof input.payload.integrationDeliveryMessageTemplate === "string" &&
    input.payload.integrationDeliveryMessageTemplate.trim().length > 0
      ? input.payload.integrationDeliveryMessageTemplate
      : null;

  if (overrideTemplate !== null) {
    const resolved = await applyFieldPolicyPlaceholders(overrideTemplate, input.payload);
    return appendReceiptEvidenceDetails(
      applyPayloadPlaceholders(resolved, input.payload, input.eventType)
    );
  }

  const automaticFieldLines = renderAutomaticDeliveryFieldLines(input.payload);
  if (automaticFieldLines !== null) {
    const header = await renderSurfaceHeaderTemplate(input);
    return appendReceiptEvidenceDetails(`${header}\n${automaticFieldLines}`);
  }

  const surface = await resolveIntegrationSurfaceForWorkspaceType(input.workspaceType);
  const template = surface?.messageTemplates?.[input.eventType] ?? "{{eventType}}: {{title}}";

  const resolved = await applyFieldPolicyPlaceholders(template, input.payload);
  const message = applyPayloadPlaceholders(resolved, input.payload, input.eventType);
  return appendReceiptEvidenceDetails(message);
}
