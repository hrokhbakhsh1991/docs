import { SetMetadata } from "@nestjs/common";

export const REQUIRE_CAPABILITY_KEY = "casl:require_capability";

/**
 * Route-level capability gate (additive to {@link CheckAbilities} + {@link RolesGuard}).
 * Accepts product ids (`tour.form.architect`) or implementation ids (`tour.update.core`).
 * Evaluated via {@link resolveEffectiveCapabilities} on the active membership context.
 *
 * @example
 * ```ts
 * @RequireCapability("module.finance")
 * @CheckAbilities(({ ability }) => ability.can(AbilityAction.Read, "Reconciliation"))
 * ```
 */
export function RequireCapability(
  ...capabilities: readonly string[]
): MethodDecorator & ClassDecorator {
  return SetMetadata(REQUIRE_CAPABILITY_KEY, [...capabilities]);
}
