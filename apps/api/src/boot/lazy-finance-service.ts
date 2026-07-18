import {
  createFinanceRepository,
  resetFinanceRepositoryForTests,
  type FinanceRepositoryPort,
} from "../workspace-finance/finance-repository.factory";
import type { FinanceService } from "../workspace-finance/finance.service";
import { createFinanceService } from "../workspace-finance/finance.service";
import {
  resolveBootFinanceWorkspaceType,
  resolveFinanceWorkspaceDependencies,
} from "../workspace-finance/finance-dependency-registry";
import type { IBookingPaymentPort } from "../workspace-finance/ports/booking-payment.port";
import { resolveFinanceWorkspaceTypeForTenant } from "../workspace-finance/resolve-finance-workspace-type-for-tenant";

/** workspaceType → FinanceService (Phase 1.5 Commit 1). */
const financeServiceByWorkspaceType = new Map<string, FinanceService>();

/**
 * Shared booking + repository across workspaceType service instances.
 * Today all registered types use BookingPaymentAdapter; repo singleton requires one port.
 */
let sharedBookingPayments: IBookingPaymentPort | null = null;
let sharedFinanceRepository: FinanceRepositoryPort | null = null;

export function resetLazyFinanceServiceForTests(): void {
  financeServiceByWorkspaceType.clear();
  sharedBookingPayments = null;
  sharedFinanceRepository = null;
  resetFinanceRepositoryForTests();
}

function getOrCreateFinanceServiceForWorkspaceType(workspaceType: string): FinanceService {
  const existing = financeServiceByWorkspaceType.get(workspaceType);
  if (existing !== undefined) {
    return existing;
  }

  const deps = resolveFinanceWorkspaceDependencies(workspaceType);
  if (sharedBookingPayments === null || sharedFinanceRepository === null) {
    sharedBookingPayments = deps.bookingPayments;
    sharedFinanceRepository = createFinanceRepository(sharedBookingPayments);
  }

  const service = createFinanceService(
    deps.ledgerPolicy,
    sharedFinanceRepository,
    sharedBookingPayments,
    deps.receiptDefaults
  );
  financeServiceByWorkspaceType.set(workspaceType, service);
  return service;
}

/**
 * Boot / legacy composition root — Denali workspace type.
 * HTTP and authenticated call sites must use {@link resolveFinanceServiceForTenant}.
 */
export async function resolveLazyFinanceService(
  injected?: FinanceService
): Promise<FinanceService> {
  if (injected !== undefined) {
    return injected;
  }
  return getOrCreateFinanceServiceForWorkspaceType(resolveBootFinanceWorkspaceType());
}

/**
 * Phase 1.5 — tenant-aware composition (HTTP SoT as of Commit 2A).
 * Resolves tenant → workspaceType → registry ports → cached FinanceService.
 */
export async function resolveFinanceServiceForTenant(
  tenantId: string,
  injected?: FinanceService
): Promise<FinanceService> {
  if (injected !== undefined) {
    return injected;
  }
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(tenantId);
  return getOrCreateFinanceServiceForWorkspaceType(workspaceType);
}
