import type { IncomingMessage, ServerResponse } from "node:http";

import type { ProvisioningService } from "./internal/provisioning.service";
import { loadLazyRouteHandlers } from "./boot/lazy-route-handlers";
import { resolveLazyToursService } from "./boot/lazy-tours-service";
import { resolveLazyFinanceService } from "./boot/lazy-finance-service";
import { handleHealth } from "./health/health.routes";
import { resolveTraceIdFromHeaders } from "./observability/resolve-trace-id";
import { runWithTraceContext } from "./observability/trace-request-context";
import { handleHttpError, sendHttpError } from "./middleware/error-interceptor";
import { rejectRequestDuringShutdown } from "./http/shutdown-ingress";
import type { MapEnrichRouteDeps } from "./routes/api-v2/map-enrich.routes";
import type { TourStorageRepository } from "./db/tour.repository";
import type { ToursRouteDeps } from "./tours/tours.routes";
import type { FinanceRouteDeps } from "./denali-finance/finance.routes";
import type { UrbanProductRouteDeps } from "./urban/urban.routes";

export type AppDeps = Partial<ToursRouteDeps> &
  Partial<FinanceRouteDeps> &
  Partial<UrbanProductRouteDeps> &
  MapEnrichRouteDeps & {
    readonly provisioningService?: ProvisioningService;
    readonly tourStore?: TourStorageRepository;
  };

async function dispatchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AppDeps
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const method = req.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    handleHealth(req, res);
    return;
  }

  const handlers = await loadLazyRouteHandlers();

  if (method === "GET" && url.pathname === "/internal/metrics") {
    await handlers.handleInternalMetrics(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/cache/invalidate") {
    await handlers.handleCacheInvalidate(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/api/v2/tenant-config") {
    await handlers.handleTenantConfig(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/api/v2/map/enrich") {
    await handlers.handleMapEnrich(req, res, deps);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/tenants/provision") {
    const { ProvisioningService } = await import("./internal/provisioning.service");
    await handlers.handleProvisionTenant(req, res, {
      provisioningService: deps.provisioningService ?? new ProvisioningService(),
    });
    return;
  }

  if (method === "GET" && url.pathname === "/internal/test/db-pool-hold") {
    await handlers.handleDbPoolHold(req, res);
    return;
  }

  const outboxReplayMatch = url.pathname.match(/^\/internal\/outbox\/([^/]+)\/replay$/);
  if (method === "POST" && outboxReplayMatch) {
    await handlers.handleReplayOutbox(req, res, outboxReplayMatch[1]!);
    return;
  }

  const toursService = await resolveLazyToursService(deps.toursService);
  const tourDeps: ToursRouteDeps = { toursService };

  if (method === "POST" && url.pathname === "/tours") {
    await handlers.handleCreateTour(req, res, tourDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/tours") {
    await handlers.handleListTours(req, res, tourDeps);
    return;
  }

  const tourMatch = url.pathname?.match(/^\/tours\/([^/]+)$/);
  if (method === "GET" && tourMatch) {
    await handlers.handleGetTour(req, res, tourDeps, tourMatch[1]!);
    return;
  }

  if (method === "PATCH" && tourMatch) {
    await handlers.handlePatchTour(req, res, tourDeps, tourMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/urban/settings") {
    await handlers.handleGetUrbanSettings(req, res);
    return;
  }

  if (method === "PATCH" && url.pathname === "/urban/settings") {
    await handlers.handlePatchUrbanSettings(req, res);
    return;
  }

  const urbanProductDeps = { tourStore: deps.tourStore };

  if (method === "GET" && url.pathname === "/urban/catalog") {
    await handlers.handleGetUrbanCatalog(req, res, urbanProductDeps);
    return;
  }

  const urbanCatalogTourMatch = url.pathname.match(/^\/urban\/catalog\/([^/]+)$/);
  if (method === "GET" && urbanCatalogTourMatch) {
    await handlers.handleGetUrbanCatalogTour(req, res, urbanCatalogTourMatch[1]!, urbanProductDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/urban/registrations") {
    await handlers.handlePostUrbanRegistration(req, res, urbanProductDeps);
    return;
  }

  const financeService = await resolveLazyFinanceService(deps.financeService);
  const financeDeps: FinanceRouteDeps = { financeService };

  if (method === "GET" && url.pathname === "/finance/reports/summary") {
    await handlers.handleFinanceSummary(req, res, financeDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/finance/reports/open-payments") {
    await handlers.handleFinanceOpenPayments(req, res, financeDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/finance/reports/ledger-events") {
    await handlers.handleFinanceLedgerEvents(req, res, financeDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/finance/payments") {
    await handlers.handleFinanceListPayments(req, res, financeDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/finance/payments/manual") {
    await handlers.handleFinanceCreateManualPayment(req, res, financeDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/finance/receipts/pending") {
    await handlers.handleFinancePendingReceipts(req, res, financeDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/finance/receipts") {
    await handlers.handleFinanceSubmitReceipt(req, res, financeDeps);
    return;
  }

  const receiptReviewMatch = url.pathname.match(/^\/finance\/receipts\/([^/]+)\/review$/);
  if (method === "PATCH" && receiptReviewMatch) {
    await handlers.handleFinanceReviewReceipt(req, res, financeDeps, receiptReviewMatch[1]!);
    return;
  }

  const receiptUrlMatch = url.pathname.match(/^\/finance\/receipts\/([^/]+)\/url$/);
  if (method === "GET" && receiptUrlMatch) {
    await handlers.handleFinanceReceiptUrl(req, res, financeDeps, receiptUrlMatch[1]!);
    return;
  }

  sendHttpError(res, 404, { error: "not_found", code: "NOT_FOUND" });
}

export function createRequestListener(deps: AppDeps = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (rejectRequestDuringShutdown(req, res)) {
      return;
    }
    const traceId = resolveTraceIdFromHeaders(req.headers);
    await runWithTraceContext(traceId, async () => {
      try {
        await dispatchRequest(req, res, deps);
      } catch (error) {
        handleHttpError(res, error);
      }
    });
  };
}
