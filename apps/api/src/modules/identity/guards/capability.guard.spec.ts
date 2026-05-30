import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { UserRole } from "../../../common/auth/user-role.enum";
import { REQUIRE_CAPABILITY_KEY, RequireCapability } from "../../../common/casl/require-capability.decorator";
import { CapabilityGuard } from "./capability.guard";
import type { RequestContextService } from "../../../common/request-context/request-context.service";

class SampleController {
  @RequireCapability("module.finance")
  financeRoute() {
    return true;
  }

  openRoute() {
    return true;
  }
}

function mockContext(handler: object): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SampleController,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as ExecutionContext;
}

function mockRequestContext(overrides: Partial<RequestContextService>): RequestContextService {
  return {
    tryGetJwtCapabilitySnapshot: () => undefined,
    getRole: () => UserRole.Member,
    ...overrides,
  } as RequestContextService;
}

test("CapabilityGuard allows routes without RequireCapability metadata", () => {
  const guard = new CapabilityGuard(new Reflector(), mockRequestContext({}));
  assert.equal(guard.canActivate(mockContext(SampleController.prototype.openRoute)), true);
});

test("CapabilityGuard allows Owner without jwt caps", () => {
  const handler = SampleController.prototype.financeRoute;
  Reflect.defineMetadata(REQUIRE_CAPABILITY_KEY, ["module.finance"], handler);
  const guard = new CapabilityGuard(
    new Reflector(),
    mockRequestContext({ getRole: () => UserRole.Owner }),
  );
  assert.equal(guard.canActivate(mockContext(handler)), true);
});

test("CapabilityGuard allows Leader when jwt caps include capability", () => {
  const handler = SampleController.prototype.financeRoute;
  Reflect.defineMetadata(REQUIRE_CAPABILITY_KEY, ["module.finance"], handler);
  const guard = new CapabilityGuard(
    new Reflector(),
    mockRequestContext({
      getRole: () => UserRole.Leader,
      tryGetJwtCapabilitySnapshot: () => ["module.finance"],
    }),
  );
  assert.equal(guard.canActivate(mockContext(handler)), true);
});

test("CapabilityGuard rejects Leader missing jwt capability", () => {
  const handler = SampleController.prototype.financeRoute;
  Reflect.defineMetadata(REQUIRE_CAPABILITY_KEY, ["module.finance"], handler);
  const guard = new CapabilityGuard(
    new Reflector(),
    mockRequestContext({
      getRole: () => UserRole.Leader,
      tryGetJwtCapabilitySnapshot: () => ["tour.read"],
    }),
  );
  assert.throws(
    () => guard.canActivate(mockContext(handler)),
    (err: unknown) => err instanceof ForbiddenException,
  );
});

test("CapabilityGuard accepts product alias when jwt has normalized capability", () => {
  @RequireCapability("tour.form.architect")
  class AliasController {
    patch() {
      return true;
    }
  }
  const handler = AliasController.prototype.patch;
  const guard = new CapabilityGuard(
    new Reflector(),
    mockRequestContext({
      getRole: () => UserRole.Leader,
      tryGetJwtCapabilitySnapshot: () => ["tour.update.tripDetails"],
    }),
  );
  assert.equal(guard.canActivate(mockContext(handler)), true);
});
