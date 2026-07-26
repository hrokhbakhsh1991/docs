import { resolveIntegrationSurfaceForWorkspaceType } from "./resolve-integration-surface";

const FIELD_PLACEHOLDER_PATTERN = /\{\{field:([^}]+)\}\}/g;

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
  payload: Record<string, unknown>,
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

function readDeliveryFieldDecorations(
  payload: Record<string, unknown>,
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
      prefix !== undefined && prefix.length > 0 ? `${prefix} ${label}: ${value}` : `${label}: ${value}`,
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
  const template =
    surface?.messageTemplates?.[input.eventType] ?? `${input.eventType}: {{title}}`;
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
  payload: Record<string, unknown>,
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
  const overrideTemplate =
    typeof input.payload.integrationDeliveryMessageTemplate === "string" &&
    input.payload.integrationDeliveryMessageTemplate.trim().length > 0
      ? input.payload.integrationDeliveryMessageTemplate
      : null;

  if (overrideTemplate !== null) {
    const resolved = await applyFieldPolicyPlaceholders(overrideTemplate, input.payload);
    return resolved
      .replaceAll("{{title}}", resolveDeliveryTitle(input.payload))
      .replaceAll("{{aggregateId}}", resolveDeliveryAggregateId(input.payload))
      .replaceAll("{{eventType}}", input.eventType);
  }

  const automaticFieldLines = renderAutomaticDeliveryFieldLines(input.payload);
  if (automaticFieldLines !== null) {
    const header = await renderSurfaceHeaderTemplate(input);
    return `${header}\n${automaticFieldLines}`;
  }

  const surface = await resolveIntegrationSurfaceForWorkspaceType(input.workspaceType);
  const template =
    surface?.messageTemplates?.[input.eventType] ?? "{{eventType}}: {{title}}";

  const resolved = await applyFieldPolicyPlaceholders(template, input.payload);
  return resolved
    .replaceAll("{{title}}", resolveDeliveryTitle(input.payload))
    .replaceAll("{{aggregateId}}", resolveDeliveryAggregateId(input.payload))
    .replaceAll("{{eventType}}", input.eventType);
}
