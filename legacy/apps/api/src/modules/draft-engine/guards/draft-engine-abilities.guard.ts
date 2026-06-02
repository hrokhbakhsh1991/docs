import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { subject } from "@casl/ability";

import { logRbacEvent } from "../../../common/logging/rbac-logger";
import { LoggerService } from "../../../common/logger/logger.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { WorkspaceAbilityFactoryService } from "../../../common/casl/workspace-ability.factory.service";
import {
  DRAFT_ENGINE_ACCESS_POLICY,
  type DraftEngineAccessPolicy,
} from "../policies/draft-engine-access.policy";

@Injectable()
export class DraftEngineAbilitiesGuard implements CanActivate {
  constructor(
    @Inject(DRAFT_ENGINE_ACCESS_POLICY)
    private readonly accessPolicy: DraftEngineAccessPolicy,
    @Inject(WorkspaceAbilityFactoryService)
    private readonly abilityFactory: WorkspaceAbilityFactoryService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
    @Inject(LoggerService) private readonly logger: LoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method?: string; path?: string; url?: string }>();
    const endpoint =
      typeof req.path === "string"
        ? `${req.method ?? "GET"} ${req.path}`
        : typeof req.url === "string"
          ? req.url
          : undefined;

    const ability = this.abilityFactory.createForActiveRequest();
    const checkCtx = { ability, subject };
    if (!this.accessPolicy(checkCtx)) {
      logRbacEvent(this.logger, {
        tenantId: this.requestContext.getTenantId(),
        userId: this.requestContext.getUserId(),
        role: this.requestContext.getRole(),
        endpoint,
        action: "draft_engine_access_policy",
        result: "deny",
      });
      throw new ForbiddenException({
        error: {
          code: "AUTH_FORBIDDEN_ABILITY",
          message: "Insufficient permissions for draft engine access",
        },
      });
    }
    return true;
  }
}
