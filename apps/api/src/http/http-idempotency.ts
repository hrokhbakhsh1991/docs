import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import {
  computeRelayBackoff,
  readHttpIdempotencyPollBaseMs,
  readHttpIdempotencyPollMaxMs,
  sleepRelayBackoffMs,
} from "../resilience/compute-relay-backoff";
import { resolveStorageDriver } from "../storage/create-tour-storage";
import { requireActiveTenantId } from "../tenant/tenant-request-context";

export const IDEMPOTENCY_PAYLOAD_MISMATCH = "IDEMPOTENCY_PAYLOAD_MISMATCH";
export const IDEMPOTENCY_IN_PROGRESS = "IDEMPOTENCY_IN_PROGRESS";
export const HTTP_IDEMPOTENCY_TENANT_MISMATCH = "HTTP_IDEMPOTENCY_TENANT_MISMATCH";

export type IdempotentCreateTourResponse = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: unknown;
};

type StoredResponse = IdempotentCreateTourResponse;

type MemoryEntry = {
  readonly requestHash: string;
  status: "processing" | "completed";
  statusCode?: number;
  response?: StoredResponse;
  waiters: Array<(value: StoredResponse) => void>;
  completedAt?: number;
};

const memoryByKey = new Map<string, MemoryEntry>();
const memoryCompletedOrder: string[] = [];

const DEFAULT_MEMORY_MAX_ENTRIES = 512;
const DEFAULT_MEMORY_TTL_MS = 300_000;

function readMemoryMaxEntries(): number {
  const raw = process.env.HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES?.trim();
  if (!raw) {
    return DEFAULT_MEMORY_MAX_ENTRIES;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MEMORY_MAX_ENTRIES;
}

function readMemoryTtlMs(): number {
  const raw = process.env.HTTP_IDEMPOTENCY_MEMORY_TTL_MS?.trim();
  if (!raw) {
    return DEFAULT_MEMORY_TTL_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MEMORY_TTL_MS;
}

function removeCompletedKey(key: string): void {
  memoryByKey.delete(key);
  const index = memoryCompletedOrder.indexOf(key);
  if (index >= 0) {
    memoryCompletedOrder.splice(index, 1);
  }
}

function purgeExpiredCompletedEntries(now = Date.now()): void {
  const ttlMs = readMemoryTtlMs();
  for (const key of [...memoryCompletedOrder]) {
    const entry = memoryByKey.get(key);
    if (entry?.status !== "completed" || entry.completedAt === undefined) {
      continue;
    }
    if (now - entry.completedAt >= ttlMs) {
      removeCompletedKey(key);
    }
  }
}

function evictCompletedEntriesOverCap(): void {
  const maxEntries = readMemoryMaxEntries();
  while (memoryCompletedOrder.length > maxEntries) {
    const evictKey = memoryCompletedOrder.shift();
    if (evictKey === undefined) {
      break;
    }
    memoryByKey.delete(evictKey);
  }
}

function enforceMemoryIdempotencyBounds(): void {
  purgeExpiredCompletedEntries();
  evictCompletedEntriesOverCap();
}

function markMemoryEntryCompleted(key: string, entry: MemoryEntry): void {
  entry.completedAt = Date.now();
  const index = memoryCompletedOrder.indexOf(key);
  if (index >= 0) {
    memoryCompletedOrder.splice(index, 1);
  }
  memoryCompletedOrder.push(key);
  enforceMemoryIdempotencyBounds();
}

/** Test-only — reset memory driver state between specs (HT-08 / DI-IDEM-02). */
export function resetHttpIdempotencyMemoryForTests(): void {
  memoryByKey.clear();
  memoryCompletedOrder.length = 0;
}

/** @internal — memory driver diagnostics for tests. */
export function readHttpIdempotencyMemorySizeForTests(): number {
  return memoryByKey.size;
}

const POLL_DEADLINE_MS = 30_000;

async function sleepIdempotencyPollBackoff(attempt: number): Promise<void> {
  await sleepRelayBackoffMs(
    computeRelayBackoff({
      attempt,
      baseMs: readHttpIdempotencyPollBaseMs(),
      maxMs: readHttpIdempotencyPollMaxMs(),
    })
  );
}

function memoryKey(tenantId: string, idempotencyKey: string): string {
  return `${tenantId}\0${idempotencyKey}`;
}

export function readIdempotencyKey(req: IncomingMessage): string | undefined {
  const raw = req.headers["idempotency-key"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hashIdempotentRequest(method: string, path: string, rawBody: string): string {
  return createHash("sha256").update(`${method}\n${path}\n${rawBody}`).digest("hex");
}

async function waitForMemoryCompletion(key: string, requestHash: string): Promise<StoredResponse> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    const entry = memoryByKey.get(key);
    if (entry?.status === "completed" && entry.response !== undefined) {
      if (entry.requestHash !== requestHash) {
        throw new Error(IDEMPOTENCY_PAYLOAD_MISMATCH);
      }
      return entry.response;
    }
    attempt += 1;
    await sleepIdempotencyPollBackoff(attempt);
  }
  throw new Error(IDEMPOTENCY_IN_PROGRESS);
}

async function runWithMemoryIdempotency(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string,
  execute: () => Promise<StoredResponse>
): Promise<StoredResponse> {
  enforceMemoryIdempotencyBounds();
  const key = memoryKey(tenantId, idempotencyKey);
  const existing = memoryByKey.get(key);
  if (existing?.status === "completed" && existing.response !== undefined) {
    if (existing.requestHash !== requestHash) {
      throw new Error(IDEMPOTENCY_PAYLOAD_MISMATCH);
    }
    return existing.response;
  }
  if (existing?.status === "processing") {
    return waitForMemoryCompletion(key, requestHash);
  }

  const entry: MemoryEntry = {
    requestHash,
    status: "processing",
    waiters: [],
  };
  memoryByKey.set(key, entry);

  try {
    const response = await execute();
    entry.status = "completed";
    entry.statusCode = 201;
    entry.response = response;
    markMemoryEntryCompleted(key, entry);
    for (const resolve of entry.waiters) {
      resolve(response);
    }
    return response;
  } catch (error) {
    memoryByKey.delete(key);
    const index = memoryCompletedOrder.indexOf(key);
    if (index >= 0) {
      memoryCompletedOrder.splice(index, 1);
    }
    throw error;
  }
}

async function waitForPrismaCompletion(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string
): Promise<StoredResponse> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    const row = await withTenantRls(tenantId, (tx) =>
      tx.httpIdempotencyRecord.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey },
        },
      })
    );
    if (row?.status === "completed" && row.responseBody !== null) {
      if (row.requestHash !== requestHash) {
        throw new Error(IDEMPOTENCY_PAYLOAD_MISMATCH);
      }
      return row.responseBody as StoredResponse;
    }
    attempt += 1;
    await sleepIdempotencyPollBackoff(attempt);
  }
  throw new Error(IDEMPOTENCY_IN_PROGRESS);
}

async function runWithPrismaIdempotency(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string,
  execute: () => Promise<StoredResponse>
): Promise<StoredResponse> {
  const claimed = await withTenantRls(tenantId, async (tx) => {
    const existing = await tx.httpIdempotencyRecord.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey },
      },
    });
    if (existing?.status === "completed" && existing.responseBody !== null) {
      if (existing.requestHash !== requestHash) {
        throw new Error(IDEMPOTENCY_PAYLOAD_MISMATCH);
      }
      return { kind: "replay" as const, response: existing.responseBody as StoredResponse };
    }
    if (existing?.status === "processing") {
      return { kind: "wait" as const };
    }
    try {
      await tx.httpIdempotencyRecord.create({
        data: {
          tenantId,
          idempotencyKey,
          requestHash,
          status: "processing",
        },
      });
      return { kind: "owner" as const };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { kind: "wait" as const };
      }
      throw error;
    }
  });

  if (claimed.kind === "replay") {
    return claimed.response;
  }
  if (claimed.kind === "wait") {
    return waitForPrismaCompletion(tenantId, idempotencyKey, requestHash);
  }

  try {
    const response = await execute();
    await withTenantRls(tenantId, async (tx) => {
      const affected = await tx.$executeRaw`
        UPDATE http_idempotency_records
        SET status = 'completed',
            status_code = 201,
            response_body = ${JSON.stringify(response)}::jsonb,
            completed_at = now()
        WHERE tenant_id = ${tenantId}::uuid
          AND idempotency_key = ${idempotencyKey}
          AND status = 'processing'
      `;
      if (Number(affected) !== 1) {
        throw new Error(IDEMPOTENCY_IN_PROGRESS);
      }
    });
    return response;
  } catch (error) {
    await withTenantRls(tenantId, (tx) =>
      tx.httpIdempotencyRecord.deleteMany({
        where: { tenantId, idempotencyKey },
      })
    ).catch(() => undefined);
    throw error;
  }
}

function assertIdempotentCreateTenantAllowed(tenantId: string): void {
  const activeTenant = requireActiveTenantId();
  if (activeTenant !== tenantId.trim()) {
    throw new Error(HTTP_IDEMPOTENCY_TENANT_MISMATCH);
  }
}

/**
 * Runs POST /tours create once per (tenant, Idempotency-Key); parallel callers receive the same body.
 */
export async function runIdempotentCreateTour(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string,
  execute: () => Promise<StoredResponse>
): Promise<StoredResponse> {
  assertIdempotentCreateTenantAllowed(tenantId);
  if (resolveStorageDriver() !== "prisma") {
    return runWithMemoryIdempotency(tenantId, idempotencyKey, requestHash, execute);
  }
  return runWithPrismaIdempotency(tenantId, idempotencyKey, requestHash, execute);
}
