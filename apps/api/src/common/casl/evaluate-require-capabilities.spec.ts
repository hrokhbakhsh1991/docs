import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../auth/user-role.enum";

import { REQUIRE_CAPABILITY_KEY, RequireCapability } from "./require-capability.decorator";
import { assertRequireCapabilitiesForExecutionContext } from "./evaluate-require-capabilities";
import type { RequestContextService } from "../request-context/request-context.service";

class SampleController {
  @RequireCapability("module.finance")
  list() {
    return true;
  }
}

function mockExecutionContext(handler: object): { getHandler: () => object; getClass: () => object } {
  return {
    getHandler: () => handler,
    getClass: () => SampleController,
  };
}

function mockRequestContext(overrides: Partial<RequestContextService>): RequestContextService {
  return {
    tryGetRole: () => "member",
    tryGetAbilityLabels: () => undefined,
    tryGetWorkspaceCapabilities: () => undefined,
    tryGetTenantEnabledModules: () => ["finance"],
    tryGetMembershipMetadata: () => undefined,
    ...overrides,
  } as RequestContextService;
}

test("assertRequireCapabilities passes when tenant module grants capability", () => {
  const reflector = new Reflector();
  const handler = SampleController.prototype.list;
  Reflect.defineMetadata(REQUIRE_CAPABILITY_KEY, ["module.finance"], handler);

  assert.doesNotThrow(() =>
    assertRequireCapabilitiesForExecutionContext(
      mockExecutionContext(handler) as never,
      reflector,
      mockRequestContext({}),
    ),
  );
});

test("assertRequireCapabilities rejects when tenant finance module disabled", () => {
  const reflector = new Reflector();
  const handler = SampleController.prototype.list;
  Reflect.defineMetadata(REQUIRE_CAPABILITY_KEY, ["module.finance"], handler);

  assert.throws(
    () =>
      assertRequireCapabilitiesForExecutionContext(
        mockExecutionContext(handler) as never,
        reflector,
        mockRequestContext({ tryGetTenantEnabledModules: () => undefined }),
      ),
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenException);
      const body = err.getResponse() as { error?: { code?: string } };
      return body.error?.code === "AUTH_FORBIDDEN_TENANT_MODULE";
    },
  );
});

test("RequireCapability accepts product alias tour.form.architect", () => {
  const reflector = new Reflector();
  @RequireCapability("tour.form.architect")
  class AliasController {
    patch() {
      return true;
    }
  }
  const handler = AliasController.prototype.patch;
  assert.doesNotThrow(() =>
    assertRequireCapabilitiesForExecutionContext(
      mockExecutionContext(handler) as never,
      reflector,
      mockRequestContext({
        tryGetRole: () => UserRole.Member,
        tryGetMembershipMetadata: () => ({ capabilities: ["tour.form.architect"] }),
      }),
    ),
  );
});
