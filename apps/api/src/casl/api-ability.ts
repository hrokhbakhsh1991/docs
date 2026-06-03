import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import {
  buildTenantAuthz,
  parseTenantAuthContext,
  type TenantAuthContext,
} from "@app-tour/workspace-sdk";

import { tourSubject, type TourSubject } from "./tour-subject";

export type TourAction = "read" | "create" | "update";

type ApiSubject = TourSubject | "Tour";

export type ApiAbility = MongoAbility<[TourAction, ApiSubject]> & {
  readonly __tenantId: string;
};

/**
 * API ability = workspace-sdk tenant rules + Tour entity scoped by tenantId.
 */
export function createApiAbility(input: TenantAuthContext): ApiAbility {
  const context = parseTenantAuthContext(input);
  const authz = buildTenantAuthz(context);

  const { can, build } = new AbilityBuilder<ApiAbility>(createMongoAbility);
  const tenantScope = { tenantId: context.tenantId };

  if (authz.canReadTenant(context.tenantId)) {
    can("read", "Tour", tenantScope);
    can("create", "Tour", tenantScope);
    can("update", "Tour", tenantScope);
  }

  const ability = build() as ApiAbility;
  Object.defineProperty(ability, "__tenantId", {
    value: context.tenantId,
    enumerable: false,
  });
  return ability;
}

/** accessibleBy-equivalent filter — fail-closed when action is denied. */
export function accessibleByTourWhere(
  ability: ApiAbility,
  action: TourAction,
  subject: TourSubject = { tenantId: ability.__tenantId },
): { tenantId: string } {
  if (!ability.can(action, tourSubject(subject))) {
    throw new Error(`FORBIDDEN_TOUR_${action.toUpperCase()}`);
  }
  return { tenantId: ability.__tenantId };
}
