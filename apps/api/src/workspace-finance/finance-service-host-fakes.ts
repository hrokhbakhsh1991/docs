import type { FinanceActorContext } from "./ports/finance-actor-context";
import type { FinanceAuthorizationPort } from "./ports/finance-access.port";
import type { FinanceCapabilityPort } from "./ports/finance-capability.port";
import type { FinanceClockPort } from "./ports/finance-clock.port";
import type { FinanceLoggerPort } from "./ports/finance-log.port";
import type { FinanceMetricsPort } from "./ports/finance-metrics.port";
import type { FinanceStorageDriverPort } from "./ports/finance-persistence-mode.port";
import type { ReceiptProofStoragePort } from "./ports/finance-receipt-proof-url.port";
import type { FinanceSchedulePort } from "./ports/finance-schedule.port";
import type { PaymentScheduleItem } from "./finance-schedule-domain";

/** Memory-driver equivalent — skip durable ledger / degraded outbox side-effects. */
export const fakeMemoryPersistenceMode: FinanceStorageDriverPort = {
  isDurablePersistence: () => false,
  isDatabaseConfigured: () => false,
};

/** Durable-driver equivalent — enqueue ledger + persist booking-sync degraded. */
export const fakeDurablePersistenceMode: FinanceStorageDriverPort = {
  isDurablePersistence: () => true,
  isDatabaseConfigured: () => true,
};

export const fakeNoopMetrics: FinanceMetricsPort = {
  increment(): void {
    /* test noop */
  },
};

export function createRecordingMetrics(): FinanceMetricsPort & {
  readonly increments: ReadonlyArray<{
    readonly name: string;
    readonly labels?: Readonly<Record<string, string>>;
    readonly amount: number;
  }>;
} {
  const increments: {
    name: string;
    labels?: Readonly<Record<string, string>>;
    amount: number;
  }[] = [];
  return {
    increments,
    increment(name, labels, amount = 1): void {
      increments.push({ name, labels, amount });
    },
  };
}

export const fakeReceiptProofUrl: ReceiptProofStoragePort = {
  async getSignedReadUrl(): Promise<string> {
    throw new Error("MINIO_NOT_CONFIGURED");
  },
};

export const fakeNoopLog: FinanceLoggerPort = {
  warn(): void {
    /* test noop */
  },
  error(): void {
    /* test noop */
  },
};

/** Fixed clock for deterministic journal timestamps in unit tests. */
export const fakeFixedClock: FinanceClockPort = {
  nowIso: () => "2026-01-15T12:00:00.000Z",
};

/** Permissive capability — unit tests that already seed a finance-supported tenant. */
export const fakePermissiveCapability: FinanceCapabilityPort = {
  async assertEnabled(_tenantId: string) {
    return { workspaceType: "denali", theme: {} };
  },
};

/** Permissive access — unit tests that already seed operator auth. */
export const fakePermissiveAccess: FinanceAuthorizationPort = {
  assertOperatorAccess(_auth: FinanceActorContext): void {
    /* allow */
  },
  assertReceiptSubmitAccess(_auth: FinanceActorContext): void {
    /* allow */
  },
};

export const fakeEmptySchedules: FinanceSchedulePort = {
  async listAllSchedules(): Promise<PaymentScheduleItem[]> {
    return [];
  },
  async getSchedule(): Promise<PaymentScheduleItem[]> {
    return [];
  },
  async putSchedule(_tenantId, _registrationId, items) {
    return items;
  },
};

/** Host-port bundle for memory-backed FinanceService unit tests. */
export const fakeFinanceServiceHostPorts = {
  metrics: fakeNoopMetrics,
  persistenceMode: fakeMemoryPersistenceMode,
  receiptProofUrls: fakeReceiptProofUrl,
  capability: fakePermissiveCapability,
  access: fakePermissiveAccess,
  schedules: fakeEmptySchedules,
  log: fakeNoopLog,
  clock: fakeFixedClock,
} as const;
