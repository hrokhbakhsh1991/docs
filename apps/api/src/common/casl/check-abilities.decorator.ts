import { SetMetadata } from "@nestjs/common";
import { subject } from "@casl/ability";
import type { AppAbility } from "@repo/shared";

export const CHECK_ABILITIES_KEY = "casl:check_abilities_handlers";

export type CheckAbilitiesContext = {
  ability: AppAbility;
  /** CASL helper for instance rules / field conditions (e.g. `isWaiverAllowed` on Payment). */
  subject: typeof subject;
};

/**
 * Route-level CASL checks (additive to {@link RolesGuard} when both are applied).
 *
 * @example
 * ```ts
 * @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "UserMembership"))
 * @CheckAbilities(({ ability, subject }) =>
 *   ability.can(AbilityAction.Update, subject("Payment", { isWaiverAllowed: true }))
 * )
 * ```
 */
export function CheckAbilities(
  ...handlers: ReadonlyArray<(ctx: CheckAbilitiesContext) => boolean>
): MethodDecorator {
  return SetMetadata(CHECK_ABILITIES_KEY, handlers);
}
