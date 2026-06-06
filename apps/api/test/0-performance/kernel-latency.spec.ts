import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";

import { resolveTenantContextFromRequest } from "../../src/tenant-kernel/tenant-kernel";

/** Standard ingress headers (no Authorization — header path only, no DB/JWT). */
const STANDARD_AUTH_HEADERS: Record<string, string> = {
  "x-tenant-id": "bench-tenant-a",
  "x-authenticated-tenant-id": "bench-tenant-a",
  "x-user-id": "bench-user",
  "x-actor-role": "admin",
  "x-membership-status": "ACTIVE",
  "x-workspace-id": "ws-bench-1",
};

const WARMUP_ITERATIONS = 500;
const TIMED_ITERATIONS = 10_000;

/** Per-call average must stay under this budget (ms). */
const AVG_BUDGET_MS = 1;

function mockRequest(headers: Record<string, string>): IncomingMessage {
  return { headers } as IncomingMessage;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function formatMs(value: number): string {
  return value.toFixed(4);
}

/**
 * Pure in-process benchmark for `resolveTenantContextFromRequest` on the
 * standard x-tenant-id / x-authenticated-tenant-id header path.
 * Does not require DATABASE_URL (no Prisma, no JWT when Authorization is absent).
 */
describe("tenant kernel header resolution latency (0-performance)", () => {
  it(`resolves tenant context in < ${AVG_BUDGET_MS}ms average over ${TIMED_ITERATIONS} calls`, async () => {
    const req = mockRequest(STANDARD_AUTH_HEADERS);

    for (let i = 0; i < WARMUP_ITERATIONS; i += 1) {
      await resolveTenantContextFromRequest(req);
    }

    const sampleMs: number[] = [];
    for (let i = 0; i < TIMED_ITERATIONS; i += 1) {
      const start = performance.now();
      const ctx = await resolveTenantContextFromRequest(req);
      sampleMs.push(performance.now() - start);
      assert.equal(ctx.tenantId, "bench-tenant-a");
    }

    const sorted = [...sampleMs].sort((a, b) => a - b);
    const sum = sampleMs.reduce((acc, v) => acc + v, 0);
    const avgMs = sum / sampleMs.length;
    const p95Ms = percentile(sorted, 95);
    const maxMs = sorted[sorted.length - 1] ?? 0;

    const report = [
      `tenant kernel header resolution (${TIMED_ITERATIONS} samples, ${WARMUP_ITERATIONS} warmup)`,
      `  avg: ${formatMs(avgMs)} ms/call`,
      `  p95: ${formatMs(p95Ms)} ms/call`,
      `  max: ${formatMs(maxMs)} ms/call`,
      `  budget: avg < ${AVG_BUDGET_MS} ms/call`,
    ].join("\n");

    console.info(report);

    assert.ok(
      avgMs < AVG_BUDGET_MS,
      [
        `tenant kernel resolution exceeded ${AVG_BUDGET_MS}ms average budget`,
        `  measured avg: ${formatMs(avgMs)} ms/call`,
        `  p95: ${formatMs(p95Ms)} ms/call`,
        `  max: ${formatMs(maxMs)} ms/call`,
        "  kernel may be bloated (DB/JWT on header path, or excess work in resolver)",
      ].join("\n")
    );
  });
});
