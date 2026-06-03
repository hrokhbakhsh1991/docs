import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { CanonicalTourService } from "../canonical/canonical-tour.service";
import { createApiAbility } from "../casl/api-ability";
import type { TourRecord } from "../db/tour-record";
import { buildValidatedCanonicalDocument } from "./canonical-validation";
import { parseCreateTourBody } from "./create-tour.schema";

/**
 * Application service — routes delegate here. All persistence via {@link CanonicalTourService} (3.4 SoT).
 */
export class ToursService {
  constructor(private readonly canonical: CanonicalTourService) {}

  async createTour(auth: TenantAuthContext, rawBody: unknown): Promise<TourRecord> {
    const ability = createApiAbility(auth);

    const body = parseCreateTourBody(rawBody);
    assertTenantClaimMatchesAuth(body.tenantId, auth);

    const canonical = buildValidatedCanonicalDocument(body, auth.tenantId);
    return this.canonical.writeTour({
      ability,
      tenantId: auth.tenantId,
      canonical,
    });
  }

  async getTourById(auth: TenantAuthContext, tourId: string): Promise<TourRecord | null> {
    const ability = createApiAbility(auth);
    return this.canonical.readTourById(ability, tourId);
  }
}

function assertTenantClaimMatchesAuth(
  bodyTenantId: string | undefined,
  auth: TenantAuthContext,
): void {
  if (bodyTenantId !== undefined && bodyTenantId !== auth.tenantId) {
    throw new Error("FORBIDDEN_TENANT_CLAIM_MISMATCH");
  }
}
