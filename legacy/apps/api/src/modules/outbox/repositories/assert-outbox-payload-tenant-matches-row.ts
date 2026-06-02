import type { OutboxEventEntity } from "../entities/outbox-event.entity";

export class OutboxPayloadTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboxPayloadTenantMismatchError";
  }
}

const MAX_RECURSION_DEPTH = 16;
/** Case-insensitive payload keys treated as tenant identity tokens (tenantId, tenant_id, TENANT_ID, …). */
const TENANT_ID_KEY_ALIASES = new Set(["tenantid", "tenant_id"]);

function normalizeTenantId(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePayloadKey(key: string): string {
  return key.trim().toLowerCase();
}

function isTenantIdentificationKey(key: string): boolean {
  return TENANT_ID_KEY_ALIASES.has(normalizePayloadKey(key));
}

function parsePayloadRecord(row: OutboxEventEntity): Record<string, unknown> {
  const raw = row.payload as unknown;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new OutboxPayloadTenantMismatchError("OUTBOX_PAYLOAD_INVALID_JSON");
    } catch (error) {
      if (error instanceof OutboxPayloadTenantMismatchError) {
        throw error;
      }
      throw new OutboxPayloadTenantMismatchError("OUTBOX_PAYLOAD_INVALID_JSON");
    }
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function collectPayloadTenantIds(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): string[] {
  /** Depth cap prevents runaway traversal on cyclic or adversarial payload graphs. */
  if (depth > MAX_RECURSION_DEPTH) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectPayloadTenantIds(entry, depth + 1, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return [];
    }
    seen.add(value);

    const ids: string[] = [];
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (isTenantIdentificationKey(key) && typeof entry === "string" && entry.trim()) {
        ids.push(entry);
      }
      ids.push(...collectPayloadTenantIds(entry, depth + 1, seen));
    }
    return ids;
  }

  return [];
}

/** Ensures payload tenant identifiers match the authoritative outbox row tenant_id. */
export function assertOutboxPayloadTenantMatchesRow(row: OutboxEventEntity): void {
  const rowTenantId = normalizeTenantId(row.tenantId);
  const payload = parsePayloadRecord(row);
  const payloadTenantIds = collectPayloadTenantIds(payload);

  for (const payloadTenantId of payloadTenantIds) {
    if (normalizeTenantId(payloadTenantId) !== rowTenantId) {
      throw new OutboxPayloadTenantMismatchError(
        `OUTBOX_PAYLOAD_TENANT_MISMATCH row=${rowTenantId} payload=${normalizeTenantId(payloadTenantId)}`,
      );
    }
  }
}

/** Returns a mismatch error when payload tenant tokens diverge from the row tenant_id. */
export function outboxPayloadTenantMismatch(row: OutboxEventEntity): OutboxPayloadTenantMismatchError | null {
  try {
    assertOutboxPayloadTenantMatchesRow(row);
    return null;
  } catch (error) {
    if (error instanceof OutboxPayloadTenantMismatchError) {
      return error;
    }
    throw error;
  }
}
