import assert from "node:assert/strict";
import test from "node:test";
import { UnauthorizedException } from "@nestjs/common";

import { AuthAbilityContextService } from "./auth-ability-context.service";
import type { RequestContextService } from "../../common/request-context/request-context.service";

function createService(overrides: Partial<RequestContextService>): AuthAbilityContextService {
  const requestContext = {
    tryGetUserId: () => "u1",
    tryGetTenantId: () => "t1",
    tryGetRole: () => "member",
    tryGetAbilityLabels: () => ["club_member"],
    tryGetWorkspaceCapabilities: () => undefined,
    tryGetMembershipMetadata: () => undefined,
    tryGetTenantEnabledModules: () => undefined,
    tryGetJwtCapabilitySnapshot: () => undefined,
    ...overrides,
  } as RequestContextService;
  return new AuthAbilityContextService(requestContext);
}

test("getMembershipAbilityContext returns ALS labels", () => {
  const svc = createService({});
  const ctx = svc.getMembershipAbilityContext();
  assert.deepEqual(ctx.labels, ["club_member"]);
  assert.deepEqual(ctx.capabilities, []);
  assert.deepEqual(ctx.allowed_region_ids, []);
  assert.deepEqual(ctx.tenant_modules, []);
  assert.ok(ctx.effective_capabilities.includes("marketing.segment.read"));
  assert.deepEqual(ctx.jwt_capability_snapshot, []);
});

test("getMembershipAbilityContext requires authenticated tenant scope", () => {
  const svc = createService({ tryGetUserId: () => undefined });
  assert.throws(() => svc.getMembershipAbilityContext(), UnauthorizedException);
});
