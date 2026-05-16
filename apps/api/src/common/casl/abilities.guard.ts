import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { assertCheckAbilitiesForExecutionContext } from "./evaluate-check-abilities";
import { assertRequireCapabilitiesForExecutionContext } from "./evaluate-require-capabilities";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";
import { WorkspaceAbilityFactoryService } from "./workspace-ability.factory.service";

/**
 * Enforces {@link CheckAbilities} metadata on a route handler. Intended to run **after**
 * {@link AuthorizationPresenceGuard} / {@link RolesGuard} so JWT + coarse role checks stay canonical.
 *
 * **Defense in depth:** pair with {@link CaslMirrorAbilitiesGuard} on sensitive controllers so CASL rules
 * are evaluated twice per request (mitigates accidental removal of one guard or decorator drift).
 * UI CASL is not a security boundary — this guard (and the mirror) are server-side enforcement.
 */
@Injectable()
export class AbilitiesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
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
    const logContext = {
      logger: this.logger,
      tenantId: this.requestContext.getTenantId(),
      userId: this.requestContext.getUserId(),
      role: this.requestContext.getRole(),
      endpoint,
    };
    assertCheckAbilitiesForExecutionContext(
      context,
      this.reflector,
      this.abilityFactory,
      logContext,
    );
    assertRequireCapabilitiesForExecutionContext(
      context,
      this.reflector,
      this.requestContext,
      logContext,
    );
    return true;
  }
}
