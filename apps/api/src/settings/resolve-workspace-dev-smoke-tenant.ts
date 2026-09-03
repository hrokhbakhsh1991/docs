import { WORKSPACE_DEV_SMOKE_TENANT_BINDINGS } from "./workspace-dev-bootstrap-bindings.generated";
import {
  DENALI_WALLET_PILOT_SUBDOMAIN,
  DENALI_WALLET_PILOT_TENANT_ID,
} from "@app-tour/workspace-denali";

export type WorkspaceDevSmokeTenantBinding = (typeof WORKSPACE_DEV_SMOKE_TENANT_BINDINGS)[number];

export function resolveWorkspaceDevSmokeTenant(
  workspaceId: string
): WorkspaceDevSmokeTenantBinding {
  const binding = WORKSPACE_DEV_SMOKE_TENANT_BINDINGS.find(
    (entry) => entry.workspaceId === workspaceId
  );
  if (binding === undefined) {
    throw new Error(`WORKSPACE_DEV_SMOKE_TENANT_NOT_FOUND:${workspaceId}`);
  }
  return binding;
}

export function resolveWorkspaceDevSmokeTenantByTenantId(
  tenantId: string
): WorkspaceDevSmokeTenantBinding | null {
  return WORKSPACE_DEV_SMOKE_TENANT_BINDINGS.find((entry) => entry.tenantId === tenantId) ?? null;
}

const denaliSmokeBinding = resolveWorkspaceDevSmokeTenant("denali");
const urbanSmokeBinding = resolveWorkspaceDevSmokeTenant("urban");
const walletWs1SmokeBinding = resolveWorkspaceDevSmokeTenant("wallet-ws1");

/** Stable re-exports for host callers — sourced from manifest devBootstrap.smokeTenant. */
export const DENALI_SMOKE_TENANT_ID = denaliSmokeBinding.tenantId;
export const DENALI_SMOKE_SUBDOMAIN = denaliSmokeBinding.subdomain;
export const URBAN_SMOKE_TENANT_ID = urbanSmokeBinding.tenantId;
export const URBAN_SMOKE_SUBDOMAIN = urbanSmokeBinding.subdomain;
export const WALLET_WS1_SMOKE_TENANT_ID = walletWs1SmokeBinding.tenantId;
export const WALLET_WS1_SMOKE_SUBDOMAIN = walletWs1SmokeBinding.subdomain;

/** Phase 2 — Denali Wallet pilot (isolated dev/cert tenant; not the club smoke tenant). */
export { DENALI_WALLET_PILOT_TENANT_ID, DENALI_WALLET_PILOT_SUBDOMAIN };
