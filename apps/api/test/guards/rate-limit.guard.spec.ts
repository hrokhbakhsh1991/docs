import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { RateLimitGuard } from "../../src/common/guards/rate-limit.guard";

function buildExecutionContext(ip: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        ip
      })
    })
  } as ExecutionContext;
}

test("rate limit guard allows first ten requests per minute", () => {
  const guard = new RateLimitGuard();
  const context = buildExecutionContext("10.10.10.10");

  for (let i = 0; i < 10; i += 1) {
    assert.equal(guard.canActivate(context), true);
  }
});

test("rate limit guard throws 429 on eleventh request in same minute", () => {
  const guard = new RateLimitGuard();
  const context = buildExecutionContext("10.10.10.11");

  for (let i = 0; i < 10; i += 1) {
    assert.equal(guard.canActivate(context), true);
  }

  assert.throws(
    () => guard.canActivate(context),
    (error: unknown) =>
      error instanceof HttpException && error.getStatus() === 429
  );
});
