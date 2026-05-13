import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { subject } from "@casl/ability";
import { CHECK_ABILITIES_KEY, type CheckAbilitiesContext } from "./check-abilities.decorator";
import { WorkspaceAbilityFactoryService } from "./workspace-ability.factory.service";

/**
 * Phase 1 stub: mirrors {@link AbilitiesGuard} so routes can stack a second CanActivate
 * for defense-in-depth experiments without changing {@link AbilitiesGuard} behavior.
 * Phase 2: consolidate shared assertion helper to avoid duplication.
 */
@Injectable()
export class CaslMirrorAbilitiesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: WorkspaceAbilityFactoryService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers =
      this.reflector.getAllAndMerge<Array<(ctx: CheckAbilitiesContext) => boolean>>(
        CHECK_ABILITIES_KEY,
        [context.getHandler(), context.getClass()]
      ) ?? [];

    if (handlers.length === 0) {
      return true;
    }

    const ability = this.abilityFactory.createForActiveRequest();
    const checkCtx: CheckAbilitiesContext = { ability, subject };

    for (const handler of handlers) {
      if (!handler(checkCtx)) {
        throw new ForbiddenException({
          error: {
            code: "AUTH_FORBIDDEN_ABILITY",
            message: "Insufficient permissions for this operation"
          }
        });
      }
    }

    return true;
  }
}
