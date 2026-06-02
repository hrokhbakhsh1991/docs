import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  assertFinancialIdempotencyKey,
  assertFinancialMutationRunsInIdempotentScope
} from "./financial-idempotency";
import {
  getFinancialIdempotencyKeyFromContext,
  runWithIdempotentEntityManager
} from "./idempotent-transaction.context";

test("assertFinancialIdempotencyKey rejects blank", () => {
  assert.throws(() => assertFinancialIdempotencyKey(""), BadRequestException);
  assert.throws(() => assertFinancialIdempotencyKey("   "), BadRequestException);
  assert.equal(assertFinancialIdempotencyKey("  k  "), "k");
});

test("assertFinancialMutationRunsInIdempotentScope requires ALS", async () => {
  assert.throws(() => assertFinancialMutationRunsInIdempotentScope("op"), BadRequestException);
  const fakeManager = {} as import("typeorm").EntityManager;
  await runWithIdempotentEntityManager(fakeManager, async () => {
    assertFinancialMutationRunsInIdempotentScope("op");
  });
});

test("financial idempotency key is visible inside ALS scope when provided", async () => {
  const fakeManager = {} as import("typeorm").EntityManager;
  await runWithIdempotentEntityManager(
    fakeManager,
    async () => {
      assert.equal(getFinancialIdempotencyKeyFromContext(), "pay-intent-key-1");
    },
    { idempotencyKey: "pay-intent-key-1" }
  );
});
