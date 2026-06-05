import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { CanonicalTourService } from "../canonical/canonical-tour.service";
import { createApiAbility } from "../casl/api-ability";
import type { TourRecord } from "../db/tour-record";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import {
  resolveTenantFeatureFlags,
  validationVariantForFeatureFlags,
} from "../tenant/resolve-tenant-feature-flags";
import { parseCreateTourBody } from "./create-tour.schema";
import { parseUpdateTourBody } from "./update-tour.schema";

/**
 * Application service — routes delegate here. All persistence via {@link CanonicalTourService} (3.4 SoT).
 */
export class ToursService {
  constructor(private readonly canonical: CanonicalTourService) {}

  async createTour(auth: TenantAuthContext, rawBody: unknown): Promise<TourRecord> {
    const ability = createApiAbility(auth);

    const body = parseCreateTourBody(rawBody);
    assertTenantClaimMatchesAuth(body.tenantId, auth);

    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    const featureFlags = await resolveTenantFeatureFlags(auth.tenantId);
    const validationVariant = validationVariantForFeatureFlags(featureFlags);
    return this.canonical.writeTour({
      ability,
      tenantId: auth.tenantId,
      body,
      workspaceType,
      validationVariant,
      actorId: auth.userId,
    });
  }

  async getTourById(auth: TenantAuthContext, tourId: string): Promise<TourRecord | null> {
    const ability = createApiAbility(auth);
    return this.canonical.readTourById(ability, tourId);
  }

  async updateTour(auth: TenantAuthContext, tourId: string, rawBody: unknown): Promise<TourRecord> {
    const ability = createApiAbility(auth);
    const body = parseUpdateTourBody(rawBody);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    const featureFlags = await resolveTenantFeatureFlags(auth.tenantId);
    const validationVariant = validationVariantForFeatureFlags(featureFlags);
    return this.canonical.updateTour({
      ability,
      tenantId: auth.tenantId,
      tourId,
      body,
      workspaceType,
      validationVariant,
      actorId: auth.userId,
    });
  }
}

function assertTenantClaimMatchesAuth(
  bodyTenantId: string | undefined,
  auth: TenantAuthContext
): void {
  if (bodyTenantId !== undefined && bodyTenantId !== auth.tenantId) {
    throw new Error("FORBIDDEN_TENANT_CLAIM_MISMATCH");
  }
}
