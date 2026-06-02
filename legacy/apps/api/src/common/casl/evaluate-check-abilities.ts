import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { subject } from "@casl/ability";
import { CHECK_ABILITIES_KEY, type CheckAbilitiesContext } from "./check-abilities.decorator";
import { logRbacEvent } from "../logging/rbac-logger";
import type { LoggerService } from "../logger/logger.service";
import type { WorkspaceAbilityFactoryService } from "./workspace-ability.factory.service";

export type CheckAbilitiesLogContext = {
  logger: LoggerService;
  tenantId?: string;
  userId?: string;
  role?: string;
  endpoint?: string;
};

/**
 * Runs merged {@link CheckAbilities} handlers for the active route (handler + class metadata).
 * No-op when no handlers are registered (caller decides fail-open vs fail-closed policy).
 */
export function assertCheckAbilitiesForExecutionContext(
  context: ExecutionContext,
  reflector: Reflector,
  abilityFactory: WorkspaceAbilityFactoryService,
  logContext?: CheckAbilitiesLogContext,
): void {
  const handlers =
    reflector.getAllAndMerge<Array<(_ctx: CheckAbilitiesContext) => boolean>>(
      CHECK_ABILITIES_KEY,
      [context.getHandler(), context.getClass()]
    ) ?? [];

  if (handlers.length === 0) {
    return;
  }

  const ability = abilityFactory.createForActiveRequest();
  const checkCtx: CheckAbilitiesContext = { ability, subject };

  for (const handler of handlers) {
    if (!handler(checkCtx)) {
      if (logContext) {
        logRbacEvent(logContext.logger, {
          tenantId: logContext.tenantId,
          userId: logContext.userId,
          role: logContext.role,
          endpoint: logContext.endpoint,
          action: "check_abilities",
          result: "deny",
        });
      }
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_ABILITY",
          message: "Insufficient permissions for this operation"
        }
      });
    }
  }
}
