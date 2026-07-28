import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import {
  reclaimStaleProcessingHttpIdempotencyRecords,
  resolveHttpIdempotencyProcessingReclaimMs,
} from "./http-idempotency-reclaim";
import {
  computeRelayBackoff,
  readHttpIdempotencyPollBaseMs,
  readHttpIdempotencyPollMaxMs,
  sleepRelayBackoffMs,
} from "../resilience/compute-relay-backoff";
import { resolveStorageDriver } from "../storage/create-tour-storage";
import { requireActiveTenantId } from "../tenant/tenant-request-context";
import { requiresProductionGradeIntegrity } from "../server/runtime-profile";

const PRISMA_CLAIM_ATTEMPTS = 3;

function resolveLeaseHeartbeatMs(reclaimMs: number): number {
  // Must stay strictly inside the lease window (reclaim suite uses short TTLs).
  return Math.max(10, Math.floor(reclaimMs / 3));
}

export const IDEMPOTENCY_PAYLOAD_MISMATCH = "IDEMPOTENCY_PAYLOAD_MISMATCH";
export const IDEMPOTENCY_IN_PROGRESS = "IDEMPOTENCY_IN_PROGRESS";
export const HTTP_IDEMPOTENCY_TENANT_MISMATCH = "HTTP_IDEMPOTENCY_TENANT_MISMATCH";

export const IDEMPOTENCY_KEY_REQUIRED = "IDEMPOTENCY_KEY_REQUIRED";

export type IdempotentCreateTourResponse = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: unknown;
};

type StoredResponse = Record<string, unknown>;

export type HttpIdempotencyMutationOptions = {
  readonly statusCode?: number;
};

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
  execute: () => Promise<StoredResponse>,
  statusCode = 201
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
    entry.statusCode = statusCode;
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

type WaitOutcome =
  | { readonly kind: "replay"; readonly response: StoredResponse }
  | { readonly kind: "reclaim_retry" }
  | { readonly kind: "in_progress" };

async function waitForPrismaCompletion(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string
): Promise<WaitOutcome> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    if (attempt === 0 || attempt % 3 === 0) {
      await reclaimStaleProcessingHttpIdempotencyRecords().catch(() => undefined);
    }
    const row = await withTenantRls(tenantId, (tx) =>
      tx.httpIdempotencyRecord.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey },
        },
      })
    );
    if (row === null) {
      // Lease expired and row reclaimed — outer loop may re-claim as owner.
      return { kind: "reclaim_retry" };
    }
    if (row.status === "completed" && row.responseBody !== null) {
      if (row.requestHash !== requestHash) {
        throw new Error(IDEMPOTENCY_PAYLOAD_MISMATCH);
      }
      return { kind: "replay", response: row.responseBody as StoredResponse };
    }
    attempt += 1;
    await sleepIdempotencyPollBackoff(attempt);
  }
  return { kind: "in_progress" };
}

async function extendHttpIdempotencyLease(
  tenantId: string,
  idempotencyKey: string,
  leaseOwner: string,
  leaseUntil: Date
): Promise<boolean> {
  const affected = await withTenantRls(tenantId, (tx) =>
    tx.$executeRaw`
      UPDATE http_idempotency_records
      SET lease_until = ${leaseUntil}
      WHERE tenant_id = ${tenantId}::uuid
        AND idempotency_key = ${idempotencyKey}
        AND status = 'processing'
        AND lease_owner = ${leaseOwner}
    `
  );
  return Number(affected) === 1;
}

async function runAsPrismaOwner(
  tenantId: string,
  idempotencyKey: string,
  leaseOwner: string,
  execute: () => Promise<StoredResponse>,
  statusCode = 201
): Promise<StoredResponse> {
  const reclaimMs = resolveHttpIdempotencyProcessingReclaimMs();
  const heartbeatMs = resolveLeaseHeartbeatMs(reclaimMs);
  let leaseLost = false;

  const touchLease = (): void => {
    const nextUntil = new Date(Date.now() + reclaimMs);
    void extendHttpIdempotencyLease(tenantId, idempotencyKey, leaseOwner, nextUntil).then((ok) => {
      if (!ok) {
        leaseLost = true;
      }
    });
  };

  // Immediate renew so short TTLs survive until the first interval tick.
  touchLease();
  const heartbeat = setInterval(touchLease, heartbeatMs);
  heartbeat.unref?.();

  try {
    const response = await execute();
    if (leaseLost) {
      throw new Error(IDEMPOTENCY_IN_PROGRESS);
    }
    await withTenantRls(tenantId, async (tx) => {
      const affected = await tx.$executeRaw`
        UPDATE http_idempotency_records
        SET status = 'completed',
            status_code = ${statusCode},
            response_body = ${JSON.stringify(response)}::jsonb,
            completed_at = now(),
            lease_until = NULL
        WHERE tenant_id = ${tenantId}::uuid
          AND idempotency_key = ${idempotencyKey}
          AND status = 'processing'
          AND lease_owner = ${leaseOwner}
      `;
      if (Number(affected) !== 1) {
        throw new Error(IDEMPOTENCY_IN_PROGRESS);
      }
    });
    return response;
  } catch (error) {
    await withTenantRls(tenantId, (tx) =>
      tx.httpIdempotencyRecord.deleteMany({
        where: { tenantId, idempotencyKey, leaseOwner },
      })
    ).catch(() => undefined);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

async function runWithPrismaIdempotency(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string,
  execute: () => Promise<StoredResponse>,
  statusCode = 201
): Promise<StoredResponse> {
  for (let claimAttempt = 0; claimAttempt < PRISMA_CLAIM_ATTEMPTS; claimAttempt += 1) {
    const reclaimMs = resolveHttpIdempotencyProcessingReclaimMs();
    const leaseOwner = randomUUID();
    const leaseUntil = new Date(Date.now() + reclaimMs);

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
            leaseUntil,
            leaseOwner,
          },
        });
        return { kind: "owner" as const, leaseOwner };
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
    if (claimed.kind === "owner") {
      return runAsPrismaOwner(tenantId, idempotencyKey, claimed.leaseOwner, execute, statusCode);
    }

    const waited = await waitForPrismaCompletion(tenantId, idempotencyKey, requestHash);
    if (waited.kind === "replay") {
      return waited.response;
    }
    if (waited.kind === "reclaim_retry") {
      continue;
    }
    throw new Error(IDEMPOTENCY_IN_PROGRESS);
  }

  throw new Error(IDEMPOTENCY_IN_PROGRESS);
}

function assertIdempotentCreateTenantAllowed(tenantId: string): void {
  const activeTenant = requireActiveTenantId();
  if (activeTenant !== tenantId.trim()) {
    throw new Error(HTTP_IDEMPOTENCY_TENANT_MISMATCH);
  }
}

/**
 * Runs a POST mutation once per (tenant, Idempotency-Key); parallel callers receive the same body.
 */
export async function runIdempotentHttpMutation<T extends StoredResponse>(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string,
  execute: () => Promise<T>,
  options?: HttpIdempotencyMutationOptions
): Promise<T> {
  assertIdempotentCreateTenantAllowed(tenantId);
  const statusCode = options?.statusCode ?? 201;
  if (resolveStorageDriver() !== "prisma") {
    if (requiresProductionGradeIntegrity()) {
      throw new Error("HTTP_IDEMPOTENCY_MEMORY_FORBIDDEN");
    }
    return runWithMemoryIdempotency(
      tenantId,
      idempotencyKey,
      requestHash,
      execute,
      statusCode
    ) as Promise<T>;
  }
  return runWithPrismaIdempotency(
    tenantId,
    idempotencyKey,
    requestHash,
    execute,
    statusCode
  ) as Promise<T>;
}

/**
 * Runs POST /tours create once per (tenant, Idempotency-Key); parallel callers receive the same body.
 */
export async function runIdempotentCreateTour(
  tenantId: string,
  idempotencyKey: string,
  requestHash: string,
  execute: () => Promise<IdempotentCreateTourResponse>
): Promise<IdempotentCreateTourResponse> {
  return runIdempotentHttpMutation(tenantId, idempotencyKey, requestHash, execute);
}
