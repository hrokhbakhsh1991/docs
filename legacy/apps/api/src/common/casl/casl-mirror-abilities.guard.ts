import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { assertCheckAbilitiesForExecutionContext } from "./evaluate-check-abilities";
import { assertRequireCapabilitiesForExecutionContext } from "./evaluate-require-capabilities";
import { RequestContextService } from "../request-context/request-context.service";
import { WorkspaceAbilityFactoryService } from "./workspace-ability.factory.service";

/**
 * Re-runs the same {@link CheckAbilities} evaluation as {@link AbilitiesGuard} using shared logic
 * in {@link assertCheckAbilitiesForExecutionContext}. Stack **after** {@link AbilitiesGuard} on controllers
 * where privilege escalation must be blocked even if one guard is misconfigured or removed from a route.
 *
 * UI CASL is not a security boundary — server-side guards enforce permissions.
 */
@Injectable()
export class CaslMirrorAbilitiesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(WorkspaceAbilityFactoryService)
    private readonly abilityFactory: WorkspaceAbilityFactoryService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    assertCheckAbilitiesForExecutionContext(context, this.reflector, this.abilityFactory);
    assertRequireCapabilitiesForExecutionContext(context, this.reflector, this.requestContext);
    return true;
  }
}
