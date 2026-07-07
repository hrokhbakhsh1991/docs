import { randomUUID } from "node:crypto";
import { runProvisionTransaction } from "./run-provision-transaction";
import { createTenantSubscriptionOnProvision } from "./create-tenant-subscription-on-provision.ts";
import { seedTenantBrandingConfig } from "./seed-tenant-branding-config";
import { seedTenantSiteSurfacesConfig } from "./seed-tenant-site-surfaces-config";
import { seedWorkspaceWizardTemplateInTransaction } from "../settings/seed-workspace-wizard-template";
import {
  appendPlatformAuditEvent,
  PLATFORM_AUDIT_ACTION_TENANT_CREATED,
} from "./platform-audit-logger";
import { inviteTenantOwner } from "./invite-tenant-owner";
import { PLATFORM_PROVISION_INVITE_ACTOR_USER_ID } from "./platform-invite-actor-user-id";
import { buildClubSiteUrls } from "./build-club-site-urls";
import { invalidateTenantRegistryCache } from "../tenant/tenant-registry-cache";
import { assertSubdomainAvailable } from "./assert-subdomain-available";
import { resolveDefaultTenantBranding } from "../tenant/workspace-default-tenant-branding";
import { assertProductionCertifiedWorkspaceType } from "../internal/assert-production-certified-workspace";

export type ProvisionTenantSagaInput = {
  readonly subdomain: string;
  readonly workspaceType: string;
  readonly ownerPhone: string;
  readonly ownerName?: string;
  readonly actorId: string;
};

export type ProvisionTenantSagaResult = {
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
};

/**
 * P1-N-059: Provision tenant saga - atomic transaction with all setup steps.
 * 1. Create tenant row
 * 2. Seed branding config
 * 3. Seed site surfaces config
 * 4. Seed wizard template
 * 5. Append platform audit event
 * 6. Invite tenant owner
 * After commit: invalidate tenant registry cache
 */
export async function runProvisionTenantSaga(
  input: ProvisionTenantSagaInput,
): Promise<ProvisionTenantSagaResult> {
  // Validate subdomain before transaction
  await assertSubdomainAvailable(input.subdomain);
  assertProductionCertifiedWorkspaceType(input.workspaceType);

  const result = await runProvisionTransaction(async (tx) => {
    // 1. Create tenant row
    const tenantId = randomUUID();
    const theme = resolveDefaultTenantBranding(input.workspaceType);

    await tx.tenant.create({
      data: {
        id: tenantId,
        subdomain: input.subdomain,
        workspaceType: input.workspaceType,
        status: "active",
        theme,
      },
    });

    const tenant = {
      id: tenantId,
      subdomain: input.subdomain,
      workspaceType: input.workspaceType,
    };

    await createTenantSubscriptionOnProvision(tx, tenant.id);

    // 2. Seed branding config
    await seedTenantBrandingConfig(tx, tenant.id, input.workspaceType);

    // 3. Seed site surfaces config
    await seedTenantSiteSurfacesConfig(tx, tenant.id);

    // 4. Seed wizard template (same tx — repo.seed uses a separate connection)
    await seedWorkspaceWizardTemplateInTransaction(tx, tenant.id, input.workspaceType);

    // 5. Append platform audit event
    await appendPlatformAuditEvent(tx, {
      action: PLATFORM_AUDIT_ACTION_TENANT_CREATED,
      entityType: "tenant",
      entityId: tenant.id,
      actorId: input.actorId,
      metadata: {
        subdomain: tenant.subdomain,
        workspaceType: input.workspaceType,
      },
    });

    // 6. Invite tenant owner
    const invite = await inviteTenantOwner(tx, {
      tenantId: tenant.id,
      phone: input.ownerPhone,
      nameNote: input.ownerName,
      invitedByUserId: PLATFORM_PROVISION_INVITE_ACTOR_USER_ID,
    });

    // Build site URLs
    const sites = buildClubSiteUrls(tenant.subdomain);

    return {
      tenant,
      sites,
      invite,
    };
  });

  // After commit: invalidate cache
  invalidateTenantRegistryCache(result.tenant.id, result.tenant.subdomain);

  return result;
}

// Made with Bob
