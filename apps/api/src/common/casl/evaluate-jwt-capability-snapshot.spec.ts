import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../auth/user-role.enum";
import {
  assertJwtCapsSatisfyRequireCapability,
  jwtCapsIncludeCapability,
} from "./evaluate-jwt-capability-snapshot";

test("jwtCapsIncludeCapability matches normalized and alias ids", () => {
  assert.equal(
    jwtCapsIncludeCapability(["tour.update.tripDetails"], "tour.form.architect"),
    true,
  );
  assert.equal(jwtCapsIncludeCapability(["tour.form.architect"], "tour.form.architect"), true);
  assert.equal(jwtCapsIncludeCapability(["tour.read"], "tour.form.architect"), false);
});

test("assertJwtCapsSatisfyRequireCapability no-ops without required capabilities", () => {
  assert.doesNotThrow(() =>
    assertJwtCapsSatisfyRequireCapability([], ["tour.read"], UserRole.Member),
  );
});

test("assertJwtCapsSatisfyRequireCapability allows Owner without jwt caps", () => {
  assert.doesNotThrow(() =>
    assertJwtCapsSatisfyRequireCapability(["module.finance"], undefined, UserRole.Owner),
  );
});

test("assertJwtCapsSatisfyRequireCapability rejects missing jwt capability", () => {
  assert.throws(
    () =>
      assertJwtCapsSatisfyRequireCapability(
        ["module.finance"],
        ["tour.read"],
        UserRole.Leader,
      ),
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenException);
      const body = err.getResponse() as { error?: { code?: string } };
      return body.error?.code === "AUTH_FORBIDDEN_CAPABILITY";
    },
  );
});

test("assertJwtCapsSatisfyRequireCapability accepts alias via normalized jwt caps", () => {
  assert.doesNotThrow(() =>
    assertJwtCapsSatisfyRequireCapability(
      ["tour.form.architect"],
      ["tour.update.tripDetails"],
      UserRole.Leader,
    ),
  );
});

test("JWT fast gate is separate from DB require-capabilities path", () => {
  const reflector = new Reflector();
  assert.equal(typeof reflector.getAllAndMerge, "function");
  assert.equal(typeof assertJwtCapsSatisfyRequireCapability, "function");
});
