import { Injectable } from "@nestjs/common";
import {
  defineAbilityFor,
  type AppAbility,
  type UserAbilityContext,
  type UserAbilityMembershipStatus
} from "@repo/shared-rbac";
import { RequestContextService } from "../request-context/request-context.service";

/**
 * Builds a per-request {@link AppAbility} from ALS-backed {@link RequestContextService}.
 * `membership_status` and labels are populated by auth / future loaders.
 */
@Injectable()
export class WorkspaceAbilityFactoryService {
  constructor(private readonly requestContext: RequestContextService) {}

  /**
   * Returns an ability for the authenticated workspace actor.
   * When user id or role is missing, yields a minimal fail-closed ability (read-only workspace shell).
   */
  createForActiveRequest(): AppAbility {
    const id = this.requestContext.tryGetUserId();
    const role = this.requestContext.tryGetRole();
    if (!id || !role) {
      return defineAbilityFor({
        id: "00000000-0000-4000-8000-000000000000",
        role: "none",
        status: "SUSPENDED"
      });
    }

    const status =
      (this.requestContext.tryGetWorkspaceMembershipStatus() as UserAbilityMembershipStatus | undefined) ??
      "ACTIVE";
    const labels = this.requestContext.tryGetAbilityLabels() ?? null;

    const ctx: UserAbilityContext = {
      id,
      role,
      status,
      labels
    };
    return defineAbilityFor(ctx);
  }
}
