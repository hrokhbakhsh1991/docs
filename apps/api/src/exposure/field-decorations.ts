export type ExposureFieldDecoration = {
  readonly prefix: string;
};

export type ExposureFieldDecorations = Readonly<Record<string, ExposureFieldDecoration>>;

export const EXPOSURE_FIELD_DECORATION_PREFIX_MAX_LENGTH = 16;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDecorationPrefix(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, EXPOSURE_FIELD_DECORATION_PREFIX_MAX_LENGTH);
}

/**
 * Normalizes intent-scoped Telegram field decoration prefixes.
 * Drops entries for disallowed or unselected field ids and empty prefixes.
 */
export function normalizeFieldDecorations(
  raw: unknown,
  input: {
    readonly allowedFieldIds: ReadonlySet<string>;
    readonly selectedFieldIds: readonly string[];
  },
): ExposureFieldDecorations | null {
  if (!isRecord(raw)) {
    return null;
  }

  const selectedFieldIds = new Set(
    input.selectedFieldIds.filter((fieldId) => fieldId.length > 0),
  );
  const normalized: Record<string, ExposureFieldDecoration> = {};

  for (const [fieldId, value] of Object.entries(raw)) {
    if (
      fieldId.length === 0 ||
      !input.allowedFieldIds.has(fieldId) ||
      !selectedFieldIds.has(fieldId)
    ) {
      continue;
    }
    if (!isRecord(value)) {
      continue;
    }
    const prefix = normalizeDecorationPrefix(value.prefix);
    if (prefix === null) {
      continue;
    }
    normalized[fieldId] = { prefix };
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function parseStoredFieldDecorations(
  raw: unknown,
): ExposureFieldDecorations | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const parsed: Record<string, ExposureFieldDecoration> = {};
  for (const [fieldId, value] of Object.entries(raw)) {
    if (fieldId.length === 0 || !isRecord(value)) {
      continue;
    }
    const prefix = normalizeDecorationPrefix(value.prefix);
    if (prefix === null) {
      continue;
    }
    parsed[fieldId] = { prefix };
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}
