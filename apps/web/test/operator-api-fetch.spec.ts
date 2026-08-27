import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getActiveOperatorApiFetchCountForTests,
  getQueuedOperatorApiFetchCountForTests,
  operatorApiFetch,
  resetOperatorApiFetchLimiterForTests,
} from "../src/auth/operator-api-fetch";

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("operatorApiFetch", () => {
  const previousLimit = process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES;

  afterEach(() => {
    resetOperatorApiFetchLimiterForTests();
    if (previousLimit === undefined) {
      delete process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES;
    } else {
      process.env.OPERATOR_BFF_MAX_CONCURRENT_API_FETCHES = previousLimit;
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
});
