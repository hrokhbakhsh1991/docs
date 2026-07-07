import type { ProvisionTenantSagaResult } from "./provision-tenant-saga.ts";

export type CreateTenantDevHostHint = {
  readonly marketingHost: string;
  readonly portalHost: string;
  readonly adminHost: string;
};

export type CreateTenantResponse = {
  readonly tenant: {
    readonly id: string;
    readonly subdomain: string;
    readonly workspaceType: string;
  };
  readonly sites: {
    readonly marketing: string;
    readonly portal: string;
    readonly admin: string;
  };
  readonly invite: {
    readonly inviteId: string;
    readonly inviteToken: string;
  };
  readonly devHostHint?: CreateTenantDevHostHint;
};

export function buildDevHostHint(subdomain: string): CreateTenantDevHostHint | undefined {
  const root = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  if (root === "localhost" || process.env.NODE_ENV === "test") {
    return {
      marketingHost: `${subdomain}.localhost`,
      portalHost: `${subdomain}.portal.localhost`,
      adminHost: `${subdomain}.admin.localhost`,
    };
  }
  return undefined;
}

export function toCreateTenantResponse(result: ProvisionTenantSagaResult): CreateTenantResponse {
  const devHostHint = buildDevHostHint(result.tenant.subdomain);
  return {
    tenant: {
      id: result.tenant.id,
      subdomain: result.tenant.subdomain,
      workspaceType: result.tenant.workspaceType,
    },
    sites: {
      marketing: result.sites.marketing,
      portal: result.sites.portal,
      admin: result.sites.admin,
    },
    invite: {
      inviteId: result.invite.inviteId,
      inviteToken: result.invite.inviteToken,
    },
    ...(devHostHint ? { devHostHint } : {}),
  };
}
