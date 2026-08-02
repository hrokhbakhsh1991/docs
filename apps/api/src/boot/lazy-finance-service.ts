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
import { createFinanceObligationPort } from "../workspace-finance/finance-obligation.factory";
import { resolveFinanceWorkspaceTypeForTenant } from "../workspace-finance/resolve-finance-workspace-type-for-tenant";
import { createBookingPaymentPort } from "../bookings/create-booking-payment-port";
import { getBookingsRepository } from "../bookings/create-bookings-repository";
import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

/** workspaceType → FinanceService (workspace policies differ; platform I/O is shared). */
const financeServiceByWorkspaceType = new Map<string, FinanceService>();
/** First-hit in-flight compose promises — avoids duplicate services under concurrent HTTP. */
const financeServiceInflightByWorkspaceType = new Map<string, Promise<FinanceService>>();

/**
 * Platform-owned persistence + booking projection — intentionally process-wide.
 *
 * Not workspace-scoped: Prisma/memory repos enforce tenant isolation (RLS / tenantId).
 * Workspace differentiation is ledgerPolicy + receiptDefaults on each FinanceService.
 * Never taken from the first-composed workspace (B2.2 — no first-wins).
 */
let platformBookingPayments: IBookingPaymentPort | null = null;
let platformFinanceRepository: FinanceRepositoryPort | null = null;

/** Stateless host adapters — safe to share across workspaceType service instances. */
let sharedRegistrationDisplay: RegistrationDisplayPort | null = null;
let sharedMetrics: FinanceMetricsPort | null = null;
let sharedStorageDriver: FinanceStorageDriverPort | null = null;
let sharedReceiptProofStorage: ReceiptProofStoragePort | null = null;
let sharedCapability: FinanceCapabilityPort | null = null;
let sharedAuthorization: FinanceAuthorizationPort | null = null;
let sharedSchedules: FinanceSchedulePort | null = null;
let sharedLogger: FinanceLoggerPort | null = null;
let sharedClock: FinanceClockPort | null = null;
/** workspaceType → obligation port (commercial pricing bind may differ per workspace). */
const obligationByWorkspaceType = new Map<string, FinanceObligationPort>();

function getPlatformBookingPayments(): IBookingPaymentPort {
  if (platformBookingPayments === null) {
    platformBookingPayments = createBookingPaymentPort();
  }
  return platformBookingPayments;
}

function getPlatformFinanceRepository(): FinanceRepositoryPort {
  if (platformFinanceRepository === null) {
    platformFinanceRepository = createFinanceRepository(getPlatformBookingPayments());
  }
  return platformFinanceRepository;
}

export function resetLazyFinanceServiceForTests(): void {
  financeServiceByWorkspaceType.clear();
  financeServiceInflightByWorkspaceType.clear();
  obligationByWorkspaceType.clear();
  platformBookingPayments = null;
  platformFinanceRepository = null;
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

/** B2.2 — inspect intentional platform sharing (tests / diagnostics). */
export type PlatformFinanceCompositionSnapshot = {
  readonly bookingPayments: IBookingPaymentPort;
  readonly repository: FinanceRepositoryPort;
  readonly cachedWorkspaceTypes: readonly string[];
};

export function getPlatformFinanceCompositionSnapshot(): PlatformFinanceCompositionSnapshot | null {
  if (platformBookingPayments === null || platformFinanceRepository === null) {
    return null;
  }
  return {
    bookingPayments: platformBookingPayments,
    repository: platformFinanceRepository,
    cachedWorkspaceTypes: [...financeServiceByWorkspaceType.keys()].sort(),
  };
}

/**
 * Create or reuse FinanceService for a registry-registered workspaceType (P4-D3.b async).
 * Platform booking + repository are process singletons; policies come from the workspace registry.
 */
export async function getOrCreateFinanceServiceForWorkspaceType(
  workspaceType: string
): Promise<FinanceService> {
  const normalized = workspaceType.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("FINANCE_WORKSPACE_TYPE_REQUIRED: workspaceType is required");
  }
  const existing = financeServiceByWorkspaceType.get(normalized);
  if (existing !== undefined) {
    return existing;
  }
  const inflight = financeServiceInflightByWorkspaceType.get(normalized);
  if (inflight !== undefined) {
    return inflight;
  }

  const compose = (async (): Promise<FinanceService> => {
    const deps = await resolveFinanceWorkspaceDependencies(normalized);
    // Explicit platform ports — ignore deps.bookingPayments (avoids first-wins / per-call instances).
    const bookingPayments = getPlatformBookingPayments();
    const repository = getPlatformFinanceRepository();

    if (sharedRegistrationDisplay === null) {
      sharedRegistrationDisplay = new BookingRegistrationDisplayAdapter(getBookingsRepository());
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

    let obligation = obligationByWorkspaceType.get(normalized);
    if (obligation === undefined) {
      obligation = await createFinanceObligationPort(normalized);
      obligationByWorkspaceType.set(normalized, obligation);
    }

    const service = createFinanceService(
      deps.ledgerPolicy,
      repository,
      bookingPayments,
      deps.receiptDefaults,
      sharedRegistrationDisplay,
      sharedMetrics,
      sharedStorageDriver,
      sharedReceiptProofStorage,
      sharedCapability,
      sharedAuthorization,
      sharedSchedules,
      sharedLogger,
      sharedClock,
      obligation
    );
    financeServiceByWorkspaceType.set(normalized, service);
    return service;
  })();

  financeServiceInflightByWorkspaceType.set(normalized, compose);
  try {
    return await compose;
  } finally {
    financeServiceInflightByWorkspaceType.delete(normalized);
  }
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
