import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  assertHttpIdempotencyKeyFormat,
  assertPublicRegistrationIdempotencyKey
} from "./http-idempotency-key";

test("assertPublicRegistrationIdempotencyKey rejects missing / blank", () => {
  assert.throws(() => assertPublicRegistrationIdempotencyKey(undefined), BadRequestException);
  assert.throws(() => assertPublicRegistrationIdempotencyKey(""), BadRequestException);
  assert.throws(() => assertPublicRegistrationIdempotencyKey("   "), BadRequestException);
});

test("assertPublicRegistrationIdempotencyKey accepts UUID and returns trimmed", () => {
  const k = " 550e8400-e29b-41d4-a716-446655440000 ";
  assert.equal(assertPublicRegistrationIdempotencyKey(k), k.trim());
});

test("assertHttpIdempotencyKeyFormat rejects invalid characters", () => {
  assert.throws(() => assertHttpIdempotencyKeyFormat("has space"), BadRequestException);
  assert.throws(() => assertHttpIdempotencyKeyFormat("bad+plus"), BadRequestException);
});
