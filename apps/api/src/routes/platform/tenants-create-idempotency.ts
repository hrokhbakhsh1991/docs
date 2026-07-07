import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";

type StoredResponse = Record<string, unknown>;

type MemoryEntry = {
  readonly requestHash: string;
  status: "processing" | "completed";
  response?: StoredResponse;
  waiters: Array<(value: StoredResponse) => void>;
  completedAt?: number;
};

const memoryByKey = new Map<string, MemoryEntry>();
const memoryCompletedOrder: string[] = [];

const DEFAULT_MEMORY_MAX_ENTRIES = 512;
const DEFAULT_MEMORY_TTL_MS = 300_000;

export const PLATFORM_IDEMPOTENCY_PAYLOAD_MISMATCH = "PLATFORM_IDEMPOTENCY_PAYLOAD_MISMATCH";
export const PLATFORM_IDEMPOTENCY_IN_PROGRESS = "PLATFORM_IDEMPOTENCY_IN_PROGRESS";

function readMemoryMaxEntries(): number {
  const raw = process.env.PLATFORM_IDEMPOTENCY_MEMORY_MAX_ENTRIES?.trim();
  if (!raw) return DEFAULT_MEMORY_MAX_ENTRIES;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MEMORY_MAX_ENTRIES;
}

function readMemoryTtlMs(): number {
  const raw = process.env.PLATFORM_IDEMPOTENCY_MEMORY_TTL_MS?.trim();
  if (!raw) return DEFAULT_MEMORY_TTL_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MEMORY_TTL_MS;
}

function purgeExpiredCompletedEntries(now = Date.now()): void {
  const ttlMs = readMemoryTtlMs();
  for (const key of [...memoryCompletedOrder]) {
    const entry = memoryByKey.get(key);
    if (entry?.status !== "completed" || entry.completedAt === undefined) continue;
    if (now - entry.completedAt >= ttlMs) {
      memoryByKey.delete(key);
      const index = memoryCompletedOrder.indexOf(key);
      if (index >= 0) memoryCompletedOrder.splice(index, 1);
    }
  }
}

function evictCompletedEntriesOverCap(): void {
  const maxEntries = readMemoryMaxEntries();
  while (memoryCompletedOrder.length > maxEntries) {
    const evictKey = memoryCompletedOrder.shift();
    if (evictKey === undefined) break;
    memoryByKey.delete(evictKey);
  }
}

function enforceMemoryBounds(): void {
  purgeExpiredCompletedEntries();
  evictCompletedEntriesOverCap();
}

function markCompleted(key: string, entry: MemoryEntry): void {
  entry.completedAt = Date.now();
  const index = memoryCompletedOrder.indexOf(key);
  if (index >= 0) memoryCompletedOrder.splice(index, 1);
  memoryCompletedOrder.push(key);
  enforceMemoryBounds();
}

export function readPlatformIdempotencyKey(req: IncomingMessage): string | undefined {
  const raw = req.headers["idempotency-key"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hashPlatformIdempotentRequest(
  method: string,
  path: string,
  rawBody: string
): string {
  return createHash("sha256").update(`${method}\n${path}\n${rawBody}`).digest("hex");
}

const POLL_DEADLINE_MS = 30_000;
const POLL_BASE_MS = 50;
const POLL_MAX_MS = 1000;

async function sleepBackoff(attempt: number): Promise<void> {
  const delay = Math.min(POLL_BASE_MS * Math.pow(2, attempt), POLL_MAX_MS);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function waitForCompletion(key: string, requestHash: string): Promise<StoredResponse> {
  const deadline = Date.now() + POLL_DEADLINE_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    const entry = memoryByKey.get(key);
    if (entry?.status === "completed" && entry.response !== undefined) {
      if (entry.requestHash !== requestHash) {
        throw new Error(PLATFORM_IDEMPOTENCY_PAYLOAD_MISMATCH);
      }
      return entry.response;
    }
    attempt += 1;
    await sleepBackoff(attempt);
  }
  throw new Error(PLATFORM_IDEMPOTENCY_IN_PROGRESS);
}

export async function runWithPlatformIdempotency(
  idempotencyKey: string,
  requestHash: string,
  execute: () => Promise<StoredResponse>
): Promise<StoredResponse> {
  enforceMemoryBounds();
  const key = idempotencyKey;
  const existing = memoryByKey.get(key);

  if (existing?.status === "completed" && existing.response !== undefined) {
    if (existing.requestHash !== requestHash) {
      throw new Error(PLATFORM_IDEMPOTENCY_PAYLOAD_MISMATCH);
    }
    return existing.response;
  }

  if (existing?.status === "processing") {
    return waitForCompletion(key, requestHash);
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
    entry.response = response;
    markCompleted(key, entry);
    for (const resolve of entry.waiters) {
      resolve(response);
    }
    return response;
  } catch (error) {
    memoryByKey.delete(key);
    throw error;
  }
}

export function resetPlatformIdempotencyMemoryForTests(): void {
  memoryByKey.clear();
  memoryCompletedOrder.length = 0;
}

// Made with Bob
