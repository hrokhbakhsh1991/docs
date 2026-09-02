/**
 * WALLET-P1 — tenant → workspaceType for wallet module gate.
 * Lookup mirrors finance gate (Prisma tenant row, then registered-tenant fallback).
 */

import { resolveRegisteredTenantById } from "../tenant/resolve-registered-tenant";
import {
  TENANT_REGISTRY_ADMIN_REASON,
  findTenantFinanceWorkspaceRow,
} from "../tenant/tenant-registry-admin.port";
import { WALLET_WORKSPACE_UNSUPPORTED } from "@app-tour/workspace-sdk/wallet";

export { WALLET_WORKSPACE_UNSUPPORTED };

export type WalletTenantWorkspaceRow = {
  readonly workspaceType: string;
  readonly theme: unknown;
};

/** True when wallet gate failed closed for an unsupported or missing tenant. */
export function isWalletWorkspaceUnsupportedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === WALLET_WORKSPACE_UNSUPPORTED ||
      error.message.startsWith(`${WALLET_WORKSPACE_UNSUPPORTED}:`))
  );
}

/**
 * Raw tenant wallet row (workspaceType + theme). Null when tenant cannot be resolved.
 */
export async function resolveWalletTenantWorkspaceRow(
  tenantId: string,
): Promise<WalletTenantWorkspaceRow | null> {
  const trimmed = tenantId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const row = await findTenantFinanceWorkspaceRow(
        trimmed,
        TENANT_REGISTRY_ADMIN_REASON.REGISTRY_RESOLVE_FINANCE_WORKSPACE,
      );
      if (row !== null) {
        return row;
      }
    } catch {
      // Postgres unavailable — fall back to static registry (dev/test smoke).
    }
  }

  const registered = await resolveRegisteredTenantById(trimmed);
  if (registered === null) {
    return null;
  }
  return {
    workspaceType: registered.workspaceType,
    theme: registered.theme,
  };
}
