import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";

import { MembershipNotFoundError } from "../../identity/in-memory-identity.repository";
import {
  applyPortalMemberPlan,
  PortalMemberPlanNotFoundError,
  upsertPortalMemberPlan,
} from "../../identity/portal-member-plan.service";
import { assertProvisioningDevelopmentOnly } from "../../internal/provisioning-guard";
import {
  assertOpsServiceJwt,
  OPS_SCOPE_PORTAL_ENTITLEMENTS,
  readAuthorizationHeader,
} from "../../internal/verify-ops-service-jwt";
import { handleHttpError, sendHttpError } from "../../middleware/error-interceptor";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "../../http/json";
import { isProductionAuthMode } from "../../tenant-kernel/auth-env";

const upsertBodySchema = z
  .object({
    tenantId: z.string().uuid(),
    planCode: z.string().min(1).max(128),
    displayName: z.string().min(1).max(256),
    moduleGrants: z.array(z.string().min(1).max(64)).max(64),
    capabilityFlags: z.record(z.string().min(1).max(128), z.boolean()).optional(),
    active: z.boolean().optional(),
  })
  .strict();

const applyBodySchema = z
  .object({
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    planCode: z.string().min(1).max(128),
  })
  .strict();

async function assertPortalEntitlementsAllowed(req: IncomingMessage): Promise<void> {
  if (isProductionAuthMode()) {
    await assertOpsServiceJwt(readAuthorizationHeader(req), OPS_SCOPE_PORTAL_ENTITLEMENTS);
    return;
  }
  assertProvisioningDevelopmentOnly();
}

export async function handlePortalMemberEntitlementsInternal(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<void> {
  try {
    await assertPortalEntitlementsAllowed(req);
    const rawBody = await readRequestBodyRaw(req);
    const body = parseJsonBody(rawBody);

    if (pathname === "/internal/portal-member-entitlements/plans/upsert") {
      const input = upsertBodySchema.parse(body);
      const plan = await upsertPortalMemberPlan(input);
      sendJson(res, 200, {
        ok: true,
        id: plan.id,
        tenantId: plan.tenantId,
        planCode: plan.planCode,
        displayName: plan.displayName,
        moduleGrants: plan.moduleGrants,
        capabilityFlags: plan.capabilityFlags,
        active: plan.active,
      });
      return;
    }

    if (pathname === "/internal/portal-member-entitlements/apply-plan") {
      const input = applyBodySchema.parse(body);
      const result = await applyPortalMemberPlan(input);
      sendJson(res, 200, result);
      return;
    }

    sendHttpError(res, 404, { error: "not_found", code: "ROUTE_NOT_FOUND" });
  } catch (error) {
    if (error instanceof PortalMemberPlanNotFoundError) {
      sendHttpError(res, 404, {
        error: "not_found",
        code: "PORTAL_MEMBER_PLAN_NOT_FOUND",
      });
      return;
    }
    if (error instanceof MembershipNotFoundError) {
      sendHttpError(res, 404, {
        error: "not_found",
        code: "MEMBERSHIP_NOT_FOUND",
      });
      return;
    }
    handleHttpError(res, error);
  }
}
