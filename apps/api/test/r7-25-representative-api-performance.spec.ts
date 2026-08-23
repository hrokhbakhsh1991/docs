/**
 * PROD-7 R7-25 — representative API p95/p99 read latency proof.
 *
 * Local pre-staging evidence only: in-process HTTP server with memory storage.
 * Covers the required API categories without depending on staging/prod.
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  resetBookingsRepositorySingletonForTests,
} from "../src/bookings/create-bookings-repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorBookingsFixture } from "./fixtures/operator-bookings-fixture";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient, type HttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type PerfEndpoint = {
  readonly id: "catalog" | "bookings" | "finance" | "settings";
  readonly method: "GET";
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly expectedStatuses: readonly number[];
  readonly p95BudgetMs: number;
  readonly p99BudgetMs: number;
};

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function createRepresentativePerfListener() {
  const repo = new InMemoryTourRepository();
  repo.ensureOperatorSmokeSeedTour();
  return createRequestListener({
    toursService: createTestToursService(repo),
    tourStore: repo,
  });
}

async function measureEndpoint(
  client: HttpTestClient,
  endpoint: PerfEndpoint
): Promise<{ readonly p95: number; readonly p99: number }> {
  const warmup = await client.requestJson(endpoint.method, endpoint.path, {
    headers: endpoint.headers,
  });
  assert.ok(
    endpoint.expectedStatuses.includes(warmup.status),
    `${endpoint.id} warmup returned ${warmup.status}`
  );

  const samples: number[] = [];
  for (let i = 0; i < 40; i += 1) {
    const start = performance.now();
    const response = await client.requestJson(endpoint.method, endpoint.path, {
      headers: endpoint.headers,
    });
    samples.push(performance.now() - start);
    assert.ok(
      endpoint.expectedStatuses.includes(response.status),
      `${endpoint.id} sample ${i + 1} returned ${response.status}`
    );
  }

  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

describe("r7-25-representative-api-performance.spec.ts", () => {
  const client = installHttpTestClient(createRepresentativePerfListener);

  before(() => {
    seedOperatorIdentityFixture();
    resetBookingsRepositorySingletonForTests();
    seedOperatorBookingsFixture();
  });

  it("R7-25 records catalog/bookings/finance/settings p95 and p99", async () => {
    const endpoints: readonly PerfEndpoint[] = [
      {
        id: "catalog",
        method: "GET",
        path: "/denali/catalog?limit=50",
        headers: { "x-tenant-id": OPERATOR_SMOKE.tenantId },
        expectedStatuses: [200],
        p95BudgetMs: 150,
        p99BudgetMs: 300,
      },
      {
        id: "bookings",
        method: "GET",
        path: "/bookings?view=ops&limit=50",
        headers: operatorAuthHeaders(),
        expectedStatuses: [200],
        p95BudgetMs: 150,
        p99BudgetMs: 300,
      },
      {
        id: "finance",
        method: "GET",
        path: "/finance/reports/summary",
        headers: operatorAuthHeaders(),
        expectedStatuses: [200, 503],
        p95BudgetMs: 150,
        p99BudgetMs: 300,
      },
      {
        id: "settings",
        method: "GET",
        path: "/settings/branding",
        headers: operatorAuthHeaders(),
        expectedStatuses: [200],
        p95BudgetMs: 150,
        p99BudgetMs: 300,
      },
    ];

    for (const endpoint of endpoints) {
      const result = await measureEndpoint(client, endpoint);
      console.info(
        `R7-25 ${endpoint.id} p95=${result.p95.toFixed(2)}ms p99=${result.p99.toFixed(2)}ms`
      );
      assert.ok(
        result.p95 < endpoint.p95BudgetMs,
        `${endpoint.id} p95 ${result.p95.toFixed(2)}ms exceeded ${endpoint.p95BudgetMs}ms`
      );
      assert.ok(
        result.p99 < endpoint.p99BudgetMs,
        `${endpoint.id} p99 ${result.p99.toFixed(2)}ms exceeded ${endpoint.p99BudgetMs}ms`
      );
    }
  });
});
