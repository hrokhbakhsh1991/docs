import { OPERATOR_SMOKE } from "./operator-smoke-e2e-tenant";
import {
  resetIdentityRepositoryForTests,
} from "../../src/identity/create-identity-repository";

export function seedOperatorIdentityFixture(): void {
  const repo = resetIdentityRepositoryForTests();
  repo.seedUser({ id: OPERATOR_SMOKE.ownerUserId, mobile: OPERATOR_SMOKE.ownerMobile });
  repo.seedUser({ id: OPERATOR_SMOKE.inviteeUserId, mobile: OPERATOR_SMOKE.inviteMobile });
  repo.seedMembership({
    userId: OPERATOR_SMOKE.ownerUserId,
    tenantId: OPERATOR_SMOKE.tenantId,
    role: "owner",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-smoke",
  });
}

export function operatorAuthHeaders(): Record<string, string> {
  return {
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": OPERATOR_SMOKE.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-operator-smoke",
  };
}
