import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { afterEach, describe, it } from "node:test";

import {
  getActiveOperatorApiFetchCountForTests,
  getQueuedOperatorApiFetchCountForTests,
  operatorApiFetch,
  resetOperatorApiFetchLimiterForTests,
} from "../src/auth/operator-api-fetch";

function listRouteFiles(dirUrl: URL): string[] {
  const routeFiles: string[] = [];
  for (const entry of readdirSync(dirUrl)) {
    const childPath = new URL(entry, dirUrl).pathname;
    const stats = statSync(childPath);
    if (stats.isDirectory()) {
      routeFiles.push(...listRouteFiles(new URL(`${entry}/`, dirUrl)));
    } else if (entry.endsWith(".ts")) {
      routeFiles.push(childPath);
    }
  }
  return routeFiles;
}

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("operatorApiFetch", () => {
  const previousLimit = process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES;
  const previousReadTimeout = process.env.OPERATOR_BFF_READ_TIMEOUT_MS;
  const previousWriteTimeout = process.env.OPERATOR_BFF_WRITE_TIMEOUT_MS;

  afterEach(() => {
    resetOperatorApiFetchLimiterForTests();
    if (previousLimit === undefined) {
      delete process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES;
    } else {
      process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES = previousLimit;
    }
    if (previousReadTimeout === undefined) {
      delete process.env.OPERATOR_BFF_READ_TIMEOUT_MS;
    } else {
      process.env.OPERATOR_BFF_READ_TIMEOUT_MS = previousReadTimeout;
    }
    if (previousWriteTimeout === undefined) {
      delete process.env.OPERATOR_BFF_WRITE_TIMEOUT_MS;
    } else {
      process.env.OPERATOR_BFF_WRITE_TIMEOUT_MS = previousWriteTimeout;
    }
  });

  it("limits concurrent upstream API fetches without changing responses", async () => {
    process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES = "2";
    let active = 0;
    let maxActive = 0;
    const releases = [defer<void>(), defer<void>(), defer<void>()];
    let calls = 0;

    const fetchImpl: typeof fetch = async () => {
      const release = releases[calls++]!;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await release.promise;
      active -= 1;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const first = operatorApiFetch("http://api.test/one", undefined, fetchImpl);
    const second = operatorApiFetch("http://api.test/two", undefined, fetchImpl);
    const third = operatorApiFetch("http://api.test/three", undefined, fetchImpl);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 2);
    assert.equal(maxActive, 2);
    assert.equal(getActiveOperatorApiFetchCountForTests(), 2);
    assert.equal(getQueuedOperatorApiFetchCountForTests(), 1);

    releases[0]!.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 3);
    assert.equal(getActiveOperatorApiFetchCountForTests(), 2);
    assert.equal(getQueuedOperatorApiFetchCountForTests(), 0);

    releases[1]!.resolve();
    releases[2]!.resolve();
    const responses = await Promise.all([first, second, third]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200, 200]
    );
    assert.equal(maxActive, 2);
    assert.equal(getActiveOperatorApiFetchCountForTests(), 0);
  });

  it("retries retryable read-side tenant DB budget responses once", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({
            error: "tenant_db_budget_exceeded",
            code: "TENANT_DB_BUDGET_EXCEEDED",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const response = await operatorApiFetch(
      "http://api.test/bookings/summary",
      { method: "GET" },
      fetchImpl
    );

    assert.equal(calls, 2);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(getActiveOperatorApiFetchCountForTests(), 0);
  });

  it("does not retry write-side tenant DB budget responses", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          error: "tenant_db_budget_exceeded",
          code: "TENANT_DB_BUDGET_EXCEEDED",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    };

    const response = await operatorApiFetch(
      "http://api.test/bookings/example/cancel",
      { method: "POST" },
      fetchImpl
    );

    assert.equal(calls, 1);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "tenant_db_budget_exceeded",
      code: "TENANT_DB_BUDGET_EXCEEDED",
    });
  });

  it("preserves non-retryable 503 response bodies", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: "service_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    };

    const response = await operatorApiFetch("http://api.test/health", { method: "GET" }, fetchImpl);

    assert.equal(calls, 1);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "service_unavailable" });
  });

  it("times out hung read-side upstream requests and releases the limiter slot", async () => {
    process.env.OPERATOR_BFF_READ_TIMEOUT_MS = "20";
    const fetchImpl: typeof fetch = async (_input, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    await assert.rejects(
      operatorApiFetch("http://api.test/dashboard", { method: "GET" }, fetchImpl),
      /AbortError|aborted/
    );

    assert.equal(getActiveOperatorApiFetchCountForTests(), 0);
    assert.equal(getQueuedOperatorApiFetchCountForTests(), 0);
  });

  it("times out hung write-side upstream requests without retrying", async () => {
    process.env.OPERATOR_BFF_WRITE_TIMEOUT_MS = "20";
    let calls = 0;
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls += 1;
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    await assert.rejects(
      operatorApiFetch("http://api.test/auth/request-otp", { method: "POST" }, fetchImpl),
      /AbortError|aborted/
    );

    assert.equal(calls, 1);
    assert.equal(getActiveOperatorApiFetchCountForTests(), 0);
    assert.equal(getQueuedOperatorApiFetchCountForTests(), 0);
  });

  it("keeps internal Admin BFF API proxies on the bounded fetch path", () => {
    const routeFiles = listRouteFiles(new URL("../app/api/", import.meta.url));
    const violations = routeFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      if (!source.includes("resolveTourOpsApiBaseUrl")) {
        return [];
      }
      return source
        .split("\n")
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => line.includes("await fetch("))
        .filter(({ line }) => !line.includes("await fetch(sourceUrl"))
        .map(({ line, lineNumber }) => `${filePath}:${lineNumber}: ${line.trim()}`);
    });

    assert.deepEqual(violations, []);
  });
});
