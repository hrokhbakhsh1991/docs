import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { authRequiredError } from "../../../common/errors/error-response-builders";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { toDraftScope, type DraftScope } from "@repo/shared-contracts";

@Injectable()
export class DraftScopeResolver {
  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  resolveOrThrow(paramTenantId: string, draftKey: string): DraftScope {
    const jwtTenantId = this.requestContext.resolveEffectiveTenantId()?.trim().toLowerCase();
    const normalized = paramTenantId.trim().toLowerCase();
    if (!jwtTenantId || jwtTenantId !== normalized) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Draft access requires a token scoped to this workspace",
        },
      });
    }

    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }

    return toDraftScope(normalized, userId, draftKey);
  }
}
