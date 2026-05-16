import type { LoggerService } from "../logger/logger.service";

export type RbacLogInput = {
  tenantId?: string;
  userId?: string;
  action: string;
  capability?: string;
  result: "allow" | "deny" | "ok" | "error";
  endpoint?: string;
  role?: string;
  extra?: Record<string, unknown>;
};

/** Structured RBAC / capability decision logging. */
export function logRbacEvent(logger: LoggerService, input: RbacLogInput): void {
  logger.info("RBAC_EVENT", {
    tenant_id: input.tenantId,
    user_id: input.userId,
    action: input.action,
    capability: input.capability,
    result: input.result,
    endpoint: input.endpoint,
    role: input.role,
    ...input.extra,
  });
}
