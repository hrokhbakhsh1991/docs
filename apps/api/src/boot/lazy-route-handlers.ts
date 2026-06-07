import type { IncomingMessage, ServerResponse } from "node:http";

import type { ProvisioningService } from "../internal/provisioning.service";
import type { MapEnrichRouteDeps } from "../routes/api-v2/map-enrich.routes";
import type { ToursRouteDeps } from "../tours/tours.routes";
import type { FinanceRouteDeps } from "../denali-finance/finance.routes";

type LazyRouteHandlers = {
  readonly handleInternalMetrics: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handleCacheInvalidate: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handleTenantConfig: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handleMapEnrich: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: MapEnrichRouteDeps
  ) => Promise<void>;
  readonly handleProvisionTenant: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: { readonly provisioningService: ProvisioningService }
  ) => Promise<void>;
  readonly handleDbPoolHold: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handleReplayOutbox: (
    req: IncomingMessage,
    res: ServerResponse,
    tenantId: string
  ) => Promise<void>;
  readonly handleCreateTour: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: ToursRouteDeps
  ) => Promise<void>;
  readonly handleListTours: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: ToursRouteDeps
  ) => Promise<void>;
  readonly handleGetTour: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: ToursRouteDeps,
    tourId: string
  ) => Promise<void>;
  readonly handlePatchTour: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: ToursRouteDeps,
    tourId: string
  ) => Promise<void>;
  readonly handleGetUrbanSettings: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handlePatchUrbanSettings: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handleFinanceSummary: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceOpenPayments: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceLedgerEvents: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceListPayments: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceCreateManualPayment: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceSubmitReceipt: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceReviewReceipt: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps,
    receiptId: string
  ) => Promise<void>;
  readonly handleFinanceReceiptUrl: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps,
    receiptId: string
  ) => Promise<void>;
  readonly handleFinancePendingReceipts: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
};

let handlersPromise: Promise<LazyRouteHandlers> | null = null;

export function resetLazyRouteHandlersForTests(): void {
  handlersPromise = null;
}

export function loadLazyRouteHandlers(): Promise<LazyRouteHandlers> {
  if (handlersPromise === null) {
    handlersPromise = Promise.all([
      import("../routes/internal/metrics"),
      import("../routes/internal/cache-invalidate"),
      import("../tenant/tenant-config.routes"),
      import("../routes/api-v2/map-enrich.routes"),
      import("../routes/internal/tenants"),
      import("../routes/internal/db-pool-hold"),
      import("../routes/internal/outbox-replay"),
      import("../tours/tours.routes"),
      import("../urban/urban-settings.routes"),
      import("../denali-finance/finance.routes"),
    ]).then(
      ([
        metrics,
        cacheInvalidate,
        tenantConfig,
        mapEnrich,
        tenants,
        dbPoolHold,
        outboxReplay,
        tours,
        urbanSettings,
        finance,
      ]) => ({
        handleInternalMetrics: metrics.handleInternalMetrics,
        handleCacheInvalidate: cacheInvalidate.handleCacheInvalidate,
        handleTenantConfig: tenantConfig.handleTenantConfig,
        handleMapEnrich: mapEnrich.handleMapEnrich,
        handleProvisionTenant: tenants.handleProvisionTenant,
        handleDbPoolHold: dbPoolHold.handleDbPoolHold,
        handleReplayOutbox: outboxReplay.handleReplayOutbox,
        handleCreateTour: tours.handleCreateTour,
        handleListTours: tours.handleListTours,
        handleGetTour: tours.handleGetTour,
        handlePatchTour: tours.handlePatchTour,
        handleGetUrbanSettings: urbanSettings.handleGetUrbanSettings,
        handlePatchUrbanSettings: urbanSettings.handlePatchUrbanSettings,
        handleFinanceSummary: finance.handleFinanceSummary,
        handleFinanceOpenPayments: finance.handleFinanceOpenPayments,
        handleFinanceLedgerEvents: finance.handleFinanceLedgerEvents,
        handleFinanceListPayments: finance.handleFinanceListPayments,
        handleFinanceCreateManualPayment: finance.handleFinanceCreateManualPayment,
        handleFinanceSubmitReceipt: finance.handleFinanceSubmitReceipt,
        handleFinanceReviewReceipt: finance.handleFinanceReviewReceipt,
        handleFinanceReceiptUrl: finance.handleFinanceReceiptUrl,
        handleFinancePendingReceipts: finance.handleFinancePendingReceipts,
      })
    );
  }
  return handlersPromise;
}
