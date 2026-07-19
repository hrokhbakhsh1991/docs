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
import type { FinanceAuthorizationPort } from "../workspace-finance/ports/finance-access.port";
import type { FinanceCapabilityPort } from "../workspace-finance/ports/finance-capability.port";
import type { IBookingPaymentPort } from "../workspace-finance/ports/booking-payment.port";
import type { FinanceClockPort } from "../workspace-finance/ports/finance-clock.port";
import type { FinanceLoggerPort } from "../workspace-finance/ports/finance-log.port";
import type { FinanceMetricsPort } from "../workspace-finance/ports/finance-metrics.port";
import type { FinanceStorageDriverPort } from "../workspace-finance/ports/finance-persistence-mode.port";
import type { ReceiptProofStoragePort } from "../workspace-finance/ports/finance-receipt-proof-url.port";
import type { FinanceSchedulePort } from "../workspace-finance/ports/finance-schedule.port";
import type { RegistrationDisplayPort } from "../workspace-finance/ports/registration-display.port";
import { BookingRegistrationDisplayAdapter } from "../workspace-finance/infrastructure/booking-registration-display.adapter";
import { HostFinanceAccessAdapter } from "../workspace-finance/infrastructure/host-finance-access.adapter";
import { HostFinanceCapabilityAdapter } from "../workspace-finance/infrastructure/host-finance-capability.adapter";
import { HostFinanceClockAdapter } from "../workspace-finance/infrastructure/host-finance-clock.adapter";
import { HostFinanceLogAdapter } from "../workspace-finance/infrastructure/host-finance-log.adapter";
import { HostFinanceMetricsAdapter } from "../workspace-finance/infrastructure/host-finance-metrics.adapter";
import { HostFinancePersistenceModeAdapter } from "../workspace-finance/infrastructure/host-finance-persistence-mode.adapter";
import { HostFinanceReceiptProofUrlAdapter } from "../workspace-finance/infrastructure/host-finance-receipt-proof-url.adapter";
import { HostFinanceScheduleAdapter } from "../workspace-finance/infrastructure/host-finance-schedule.adapter";
import { resolveFinanceWorkspaceTypeForTenant } from "../workspace-finance/resolve-finance-workspace-type-for-tenant";

/** workspaceType → FinanceService (Phase 1.5 Commit 1). */
const financeServiceByWorkspaceType = new Map<string, FinanceService>();

/**
 * Shared booking + repository + registration display across workspaceType service instances.
 * Today all registered types use BookingPaymentAdapter; repo singleton requires one payment port.
 */
let sharedBookingPayments: IBookingPaymentPort | null = null;
let sharedFinanceRepository: FinanceRepositoryPort | null = null;
let sharedRegistrationDisplay: RegistrationDisplayPort | null = null;
let sharedMetrics: FinanceMetricsPort | null = null;
let sharedStorageDriver: FinanceStorageDriverPort | null = null;
let sharedReceiptProofStorage: ReceiptProofStoragePort | null = null;
let sharedCapability: FinanceCapabilityPort | null = null;
let sharedAuthorization: FinanceAuthorizationPort | null = null;
let sharedSchedules: FinanceSchedulePort | null = null;
let sharedLogger: FinanceLoggerPort | null = null;
let sharedClock: FinanceClockPort | null = null;

export function resetLazyFinanceServiceForTests(): void {
  financeServiceByWorkspaceType.clear();
  sharedBookingPayments = null;
  sharedFinanceRepository = null;
  sharedRegistrationDisplay = null;
  sharedMetrics = null;
  sharedStorageDriver = null;
  sharedReceiptProofStorage = null;
  sharedCapability = null;
  sharedAuthorization = null;
  sharedSchedules = null;
  sharedLogger = null;
  sharedClock = null;
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
  if (sharedRegistrationDisplay === null) {
    sharedRegistrationDisplay = new BookingRegistrationDisplayAdapter();
  }
  if (sharedMetrics === null) {
    sharedMetrics = new HostFinanceMetricsAdapter();
  }
  if (sharedStorageDriver === null) {
    sharedStorageDriver = new HostFinancePersistenceModeAdapter();
  }
  if (sharedReceiptProofStorage === null) {
    sharedReceiptProofStorage = new HostFinanceReceiptProofUrlAdapter();
  }
  if (sharedCapability === null) {
    sharedCapability = new HostFinanceCapabilityAdapter();
  }
  if (sharedAuthorization === null) {
    sharedAuthorization = new HostFinanceAccessAdapter();
  }
  if (sharedSchedules === null) {
    sharedSchedules = new HostFinanceScheduleAdapter();
  }
  if (sharedLogger === null) {
    sharedLogger = new HostFinanceLogAdapter();
  }
  if (sharedClock === null) {
    sharedClock = new HostFinanceClockAdapter();
  }

  const service = createFinanceService(
    deps.ledgerPolicy,
    sharedFinanceRepository,
    sharedBookingPayments,
    deps.receiptDefaults,
    sharedRegistrationDisplay,
    sharedMetrics,
    sharedStorageDriver,
    sharedReceiptProofStorage,
    sharedCapability,
    sharedAuthorization,
    sharedSchedules,
    sharedLogger,
    sharedClock
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
