import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  effectiveCapabilitiesGrant,
  normalizeProductCapabilityId,
  tryParseWorkspaceRole,
  WorkspaceRole,
  type TenantModuleId,
  type WorkspaceCapability,
} from "@repo/shared";

import { logRbacEvent } from "../logging/rbac-logger";
import { buildCapabilityGrantContextFromRequest } from "../rbac/capability-grant-context-from-request";
import type { RequestContextService } from "../request-context/request-context.service";
import { REQUIRE_CAPABILITY_KEY } from "./require-capability.decorator";
import type { CheckAbilitiesLogContext } from "./evaluate-check-abilities";

const CAPABILITY_REQUIRED_TENANT_MODULE: Partial<Record<WorkspaceCapability, TenantModuleId>> = {
  "module.finance": "finance",
  "module.form_builder": "form_builder",
};

function tenantModuleEnablesCapability(
  grantContext: ReturnType<typeof buildCapabilityGrantContextFromRequest>,
  capability: WorkspaceCapability,
): boolean {
  const moduleId = CAPABILITY_REQUIRED_TENANT_MODULE[capability];
  if (!moduleId) {
    return true;
  }
  const modules = grantContext.tenantModules ?? [];
  return modules.includes(moduleId);
}

/**
 * Enforces {@link RequireCapability} metadata (membership + tenant module grants).
 * No-op when no capabilities are required on the route.
 */
function denyCapability(
  logContext: CheckAbilitiesLogContext | undefined,
  input: {
    capability?: string;
    code: string;
    message: string;
  },
): never {
  if (logContext) {
    logRbacEvent(logContext.logger, {
      tenantId: logContext.tenantId,
      userId: logContext.userId,
      role: logContext.role,
      endpoint: logContext.endpoint,
      action: "require_capability",
      capability: input.capability,
      result: "deny",
      extra: { error_code: input.code },
    });
  }
  throw new ForbiddenException({
    error: {
      code: input.code,
      message: input.message,
      ...(input.capability ? { capability: input.capability } : {}),
    },
  });
}

export function assertRequireCapabilitiesForExecutionContext(
  context: ExecutionContext,
  reflector: Reflector,
  requestContext: RequestContextService,
  logContext?: CheckAbilitiesLogContext,
): void {
  const required =
    reflector.getAllAndMerge<readonly string[]>(REQUIRE_CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];

  const unique = [...new Set(required.filter((c) => typeof c === "string" && c.trim() !== ""))];
  if (unique.length === 0) {
    return;
  }

  const grantContext = buildCapabilityGrantContextFromRequest(requestContext);
  const role = tryParseWorkspaceRole(grantContext.role);
  if (role === WorkspaceRole.Owner || role === WorkspaceRole.Admin) {
    return;
  }

  for (const raw of unique) {
    const normalized = normalizeProductCapabilityId(raw);
    if (!normalized) {
      denyCapability(logContext, {
        capability: raw,
        code: "AUTH_FORBIDDEN_CAPABILITY",
        message: `Unknown or unsupported capability: ${raw}`,
      });
    }
    if (!tenantModuleEnablesCapability(grantContext, normalized as WorkspaceCapability)) {
      denyCapability(logContext, {
        capability: raw,
        code: "AUTH_FORBIDDEN_TENANT_MODULE",
        message: `Tenant module is not enabled for capability: ${raw}`,
      });
    }
    if (!effectiveCapabilitiesGrant(grantContext, normalized as WorkspaceCapability)) {
      denyCapability(logContext, {
        capability: raw,
        code: "AUTH_FORBIDDEN_CAPABILITY",
        message: `Insufficient capability: ${raw}`,
      });
    }
  }
}
