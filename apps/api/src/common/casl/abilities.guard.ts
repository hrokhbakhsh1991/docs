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
 * Enforces {@link CheckAbilities} metadata on a route handler. Intended to run **after**
 * {@link AuthorizationPresenceGuard} / {@link RolesGuard} so JWT + coarse role checks stay canonical.
 *
 * Handlers receive {@link CheckAbilitiesContext.subject} for field-level checks, e.g.
 * `ability.can('update', subject('Payment', { isWaiverAllowed: true }))`.
 * Align those rules with {@link defineAbilityFor} in `@repo/shared-rbac` when product hardens payment RBAC.
 *
 * **Defense in depth:** `defineAbilityFor` is the single source of truth for fine-grained workspace actions
 * (e.g. `UserMembership` create/update/delete/read). Pair every UI `ability.can` / `<Can>` gate with a matching
 * `@CheckAbilities` on the Nest route so a misconfigured `@Roles` list cannot widen access beyond CASL.
 */
@Injectable()
export class AbilitiesGuard implements CanActivate {
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
