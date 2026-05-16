import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import {
  allowedRegionIdsFromGrantContext,
  parseMembershipMetadata,
  resolveEffectiveCapabilities,
} from "@repo/shared";

import { authRequiredError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { buildCapabilityGrantContextFromRequest } from "../../common/rbac/capability-grant-context-from-request";
import type { MembershipAbilityContextDto } from "./dto/membership-ability-context.dto";

/**
 * Returns membership-driven CASL inputs for the active tenant (populated by {@link AuthMiddleware}).
 */
@Injectable()
export class AuthAbilityContextService {
  constructor(
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  getMembershipAbilityContext(): MembershipAbilityContextDto {
    const userId = this.requestContext.tryGetUserId();
    const tenantId = this.requestContext.tryGetTenantId();
    if (!userId || !tenantId) {
      throw new UnauthorizedException(authRequiredError());
    }

    const grantContext = buildCapabilityGrantContextFromRequest(this.requestContext);
    const meta = parseMembershipMetadata(grantContext.membershipMetadata);

    const effective = resolveEffectiveCapabilities(grantContext);

    return {
      labels: [...(this.requestContext.tryGetAbilityLabels() ?? [])],
      capabilities: [
        ...(this.requestContext.tryGetWorkspaceCapabilities() ?? []),
        ...(meta.capabilities ?? []),
      ],
      effective_capabilities: [...effective],
      jwt_capability_snapshot: [...(this.requestContext.tryGetJwtCapabilitySnapshot() ?? [])],
      allowed_region_ids: [...allowedRegionIdsFromGrantContext(grantContext)],
      tenant_modules: [...(this.requestContext.tryGetTenantEnabledModules() ?? [])],
    };
  }
}
