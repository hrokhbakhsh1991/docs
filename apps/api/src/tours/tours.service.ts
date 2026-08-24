import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { CanonicalTourService } from "../canonical/canonical-tour.service";
import { createApiAbility } from "../casl/api-ability";
import type { TourRecord } from "../db/tour-record";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { assertWorkspaceCommerceGatewayActivationAllowed } from "../workspace-metadata/assert-workspace-commerce-gateway-blocked.ts";
import { resolveWorkspaceCommerceConfigForTenantById } from "../workspace-metadata/resolve-workspace-commerce-for-tenant.ts";
import type { WorkspaceCommerceConfig } from "@app-tour/workspace-sdk/metadata";
import {
  resolveTenantFeatureFlags,
  validationVariantForFeatureFlags,
} from "../tenant/resolve-tenant-feature-flags";
import { applyWorkspaceCommerceDefaultToCreateBody } from "./apply-workspace-commerce-create-default";
import { buildCloneTourCreateBody } from "./build-clone-tour-body";
import type { CloneTourBody } from "./clone-tour.schema";
import type { CreateTourBody } from "./create-tour.schema";
import type { ListToursQuery, TourListResult } from "./list-tours-query";
import type { OperatorListToursQuery, OperatorTourListResult } from "./list-tours-operator";
import { applyWorkspaceServerClonePhotoRemint } from "./apply-workspace-server-clone-photo-remint";
import { resolveActiveEquipmentIdsForClone } from "./resolve-clone-equipment-ids";
import { resolveActiveDestinationIdsForClone } from "./resolve-clone-destination-ids";
import type { UpdateTourBody } from "./update-tour.schema";

/**
 * Application service — routes delegate here. All persistence via {@link CanonicalTourService} (3.4 SoT).
 * HTTP ingress validates JSON + Zod at the route boundary ({@link readTourRequestBody} + schema parsers).
 */
export type ToursServiceDeps = {
  readonly resolveCommerce?: (tenantId: string) => Promise<WorkspaceCommerceConfig>;
  readonly resolveWorkspaceType?: (tenantId: string) => Promise<string>;
};

export class ToursService {
  constructor(
    private readonly canonical: CanonicalTourService,
    private readonly deps: ToursServiceDeps = {}
  ) {}

  resolveWorkspaceType(tenantId: string): Promise<string> {
    const resolve = this.deps.resolveWorkspaceType ?? resolveWorkspaceTypeForTenant;
    return resolve(tenantId);
  }

  async createTour(auth: TenantAuthContext, body: CreateTourBody): Promise<TourRecord> {
    const ability = createApiAbility(auth);

    assertTenantClaimMatchesAuth(body.tenantId, auth);

    const workspaceType = await this.resolveWorkspaceType(auth.tenantId);
    const featureFlags = await resolveTenantFeatureFlags(auth.tenantId);
    const validationVariant = validationVariantForFeatureFlags(featureFlags);
    const resolveCommerce =
      this.deps.resolveCommerce ?? resolveWorkspaceCommerceConfigForTenantById;
    const commerce = await resolveCommerce(auth.tenantId);
    assertWorkspaceCommerceGatewayActivationAllowed(commerce);
    const bodyWithCommerce = applyWorkspaceCommerceDefaultToCreateBody(
      workspaceType,
      body,
      commerce
    );
    return this.canonical.writeTour({
      ability,
      tenantId: auth.tenantId,
      body: bodyWithCommerce,
      workspaceType,
      validationVariant,
      actorId: auth.userId,
    });
  }

  async getTourById(auth: TenantAuthContext, tourId: string): Promise<TourRecord | null> {
    const ability = createApiAbility(auth);
    return this.canonical.readTourById(ability, tourId, auth.tenantId);
  }

  async listTours(auth: TenantAuthContext, query: ListToursQuery): Promise<TourListResult> {
    const ability = createApiAbility(auth);
    return this.canonical.listTours(ability, query);
  }

  async listToursOperator(
    auth: TenantAuthContext,
    query: OperatorListToursQuery
  ): Promise<OperatorTourListResult> {
    const ability = createApiAbility(auth);
    return this.canonical.listToursOperator(ability, auth.tenantId, query);
  }

  async cloneTour(
    auth: TenantAuthContext,
    sourceTourId: string,
    body: CloneTourBody = {}
  ): Promise<TourRecord> {
    const source = await this.getTourById(auth, sourceTourId);
    if (source === null) {
      throw new Error("TOUR_NOT_FOUND");
    }

    const activeEquipmentIds =
      body.activeEquipmentIds ?? (await resolveActiveEquipmentIdsForClone(auth.tenantId));
    const activeDestinationIds =
      body.activeDestinationIds ?? (await resolveActiveDestinationIdsForClone(auth.tenantId));

    const createBody = await buildCloneTourCreateBody({
      source,
      tenantId: auth.tenantId,
      activeEquipmentIds,
      activeDestinationIds,
    });

    const record = await this.createTour(auth, createBody);
    return applyWorkspaceServerClonePhotoRemint(this, auth, record);
  }

  async updateTour(
    auth: TenantAuthContext,
    tourId: string,
    body: UpdateTourBody
  ): Promise<TourRecord> {
    const ability = createApiAbility(auth);
    const workspaceType = await this.resolveWorkspaceType(auth.tenantId);
    const featureFlags = await resolveTenantFeatureFlags(auth.tenantId);
    const validationVariant = validationVariantForFeatureFlags(featureFlags);
    const resolveCommerce =
      this.deps.resolveCommerce ?? resolveWorkspaceCommerceConfigForTenantById;
    const commerce = await resolveCommerce(auth.tenantId);
    return this.canonical.updateTour({
      ability,
      tenantId: auth.tenantId,
      tourId,
      body,
      workspaceType,
      validationVariant,
      actorId: auth.userId,
      commerce,
      auth,
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
