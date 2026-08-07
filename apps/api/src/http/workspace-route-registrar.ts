import type { IncomingMessage, ServerResponse } from "node:http";

import type { FinanceService } from "../workspace-finance/finance.service";
import type { TourStorageRepository } from "../db/tour.repository";
import { getIdentityRepository } from "../identity/create-identity-repository";
import { MembershipNotFoundError } from "../identity/in-memory-identity.repository";
import { sendHttpError } from "../middleware/error-interceptor";
import {
  WORKSPACE_HTTP_PARAM_ROUTES,
  WORKSPACE_HTTP_STATIC_ROUTES,
  type WorkspaceHttpHandlerKey,
} from "./workspace-http-routes.generated";

/** Generic HTTP handler invoked by workspace route dispatch. */
export type WorkspaceHttpHandlerFn = (
  req: IncomingMessage,
  res: ServerResponse,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry loaders bind typed workspace handlers
  ...args: any[]
) => Promise<void>;

/** All workspace-product HTTP handlers keyed by manifest/codegen handler id. */
export type WorkspaceRouteHandlers = Record<WorkspaceHttpHandlerKey, WorkspaceHttpHandlerFn>;

export type WorkspaceRouteRegistrarDeps = {
  readonly tourStore?: TourStorageRepository;
  readonly financeService?: FinanceService;
};

type WorkspaceProductRouteDeps = {
  readonly tourStore: TourStorageRepository | undefined;
  readonly resolveGuestMembership?: (
    tenantId: string,
    userId: string
  ) => Promise<{
    readonly displayName?: string | null;
    readonly nationalId?: string | null;
    readonly fatherName?: string | null;
    readonly birthDate?: string | null;
  } | null>;
  readonly saveGuestProfileFields?: (
    tenantId: string,
    userId: string,
    patch: {
      readonly displayName?: string;
      readonly nationalId?: string;
      readonly fatherName?: string;
      readonly birthDate?: string;
    }
  ) => Promise<void>;
};

type HandlerDispatchKind =
  | "bare"
  | "product"
  | "product-param"
  | "finance"
  | "finance-param";

const HANDLER_DISPATCH_KIND = {
  handleFinanceCreateManualPayment: "finance",
  handleFinanceGenerateSchedule: "finance",
  handleFinanceGetRegistrationInvoice: "finance-param",
  handleFinanceSetObligationOverride: "finance-param",
  handleFinanceGetSchedule: "finance-param",
  handleFinanceLedgerEvents: "finance",
  handleFinanceListPayments: "finance",
  handleFinanceListPrepayments: "finance",
  handleFinanceListBookingSyncDegraded: "finance",
  handleFinanceListSchedules: "finance",
  handleFinanceOpenPayments: "finance",
  handleFinancePendingReceipts: "finance",
  handleFinanceReceiptUpload: "finance",
  handleFinanceReceiptUrl: "finance-param",
  handleFinanceRecordPrepayment: "finance",
  handleFinanceReportByTour: "finance",
  handleFinanceRetryBookingSync: "finance",
  handleFinanceReviewReceipt: "finance-param",
  handleFinanceSubmitReceipt: "finance",
  handleFinanceSummary: "finance",
  handleFinancePatchScheduleItem: "finance-param",
  handleGetDenaliCatalog: "product",
  handleGetDenaliCatalogTour: "product-param",
  handleGetDenaliDashboardTour: "product-param",
  handleGetDenaliReminderFeed: "product",
  handleGetGuestClubCatalog: "bare",
  handleGetGuestClubCatalogTour: "product-param",
  handleGetHarborCatalog: "product",
  handleGetHarborCatalogTour: "product-param",
  handleGetUrbanCatalog: "product",
  handleGetUrbanCatalogTour: "product-param",
  handleGetUrbanSettings: "bare",
  handlePatchUrbanSettings: "bare",
  handlePostDenaliRegistration: "product",
  handlePostGuestClubRegistration: "bare",
  handlePostHarborRegistration: "product",
  handlePostUrbanRegistration: "product",
} as const satisfies Record<WorkspaceHttpHandlerKey, HandlerDispatchKind>;

function workspaceProductDeps(deps: WorkspaceRouteRegistrarDeps): WorkspaceProductRouteDeps {
  return {
    tourStore: deps.tourStore,
    resolveGuestMembership: async (tenantId, userId) => {
      try {
        const repo = getIdentityRepository();
        const membership = await repo.findMembership(userId, tenantId);
        if (membership === null) {
          return null;
        }
        const nationalId = membership.nationalId?.trim() ?? "";
        const fatherName = membership.fatherName?.trim() ?? "";
        const birthDate = membership.birthDate?.trim() ?? "";
        const displayName = membership.displayName?.trim() ?? "";
        return {
          displayName: displayName.length > 0 ? displayName : null,
          nationalId: nationalId.length > 0 ? nationalId : null,
          fatherName: fatherName.length > 0 ? fatherName : null,
          birthDate: birthDate.length > 0 ? birthDate : null,
        };
      } catch (error) {
        if (error instanceof MembershipNotFoundError) {
          return null;
        }
        throw error;
      }
    },
    saveGuestProfileFields: async (tenantId, userId, patch) => {
      const repo = getIdentityRepository();
      await repo.updateMembershipProfileFields(tenantId, userId, patch);
    },
  };
}

/**
 * Phase 1.5 C2A — do not eager-resolve FinanceService (that forced Denali boot type).
 * Optional inject remains for tests; production handlers resolve via auth.tenantId.
 */
function financeRouteDeps(
  deps: WorkspaceRouteRegistrarDeps
): { financeService?: FinanceService } {
  if (deps.financeService !== undefined) {
    return { financeService: deps.financeService };
  }
  return {};
}

async function dispatchWorkspaceHandler(
  handlerKey: WorkspaceHttpHandlerKey,
  req: IncomingMessage,
  res: ServerResponse,
  handler: WorkspaceHttpHandlerFn,
  deps: WorkspaceRouteRegistrarDeps,
  pathParam?: string
): Promise<void> {
  const kind = HANDLER_DISPATCH_KIND[handlerKey];

  switch (kind) {
    case "bare":
      await handler(req, res);
      return;
    case "product":
      await handler(req, res, workspaceProductDeps(deps));
      return;
    case "product-param":
      await handler(req, res, pathParam!, workspaceProductDeps(deps));
      return;
    case "finance":
      await handler(req, res, financeRouteDeps(deps));
      return;
    case "finance-param":
      await handler(req, res, financeRouteDeps(deps), pathParam!);
      return;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`WORKSPACE_HTTP_DISPATCH_UNKNOWN:${String(_exhaustive)}`);
    }
  }
}

export type ResolveWorkspaceHttpHandler = (
  key: WorkspaceHttpHandlerKey
) => Promise<WorkspaceHttpHandlerFn>;

/**
 * Collect HTTP methods registered for an exact or param-matched workspace path.
 * Empty set means the pathname is not a workspace product/finance route.
 */
export function collectWorkspaceRouteMethodsForPath(pathname: string): ReadonlySet<string> {
  const allowed = new Set<string>();
  for (const route of WORKSPACE_HTTP_STATIC_ROUTES) {
    if (pathname === route.path) {
      allowed.add(route.method);
    }
  }
  for (const route of WORKSPACE_HTTP_PARAM_ROUTES) {
    if (route.pathPattern.test(pathname)) {
      allowed.add(route.method);
    }
  }
  return allowed;
}

/**
 * Dispatches workspace-product HTTP routes. Resolves handlers lazily per key (Wave G.b).
 * Returns true when handled (including method mismatch → 405).
 */
export async function tryDispatchWorkspaceRoutes(
  method: string,
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
  resolveHandler: ResolveWorkspaceHttpHandler,
  deps: WorkspaceRouteRegistrarDeps
): Promise<boolean> {
  for (const route of WORKSPACE_HTTP_STATIC_ROUTES) {
    if (method === route.method && pathname === route.path) {
      const handler = await resolveHandler(route.handlerKey);
      await dispatchWorkspaceHandler(route.handlerKey, req, res, handler, deps);
      return true;
    }
  }

  for (const route of WORKSPACE_HTTP_PARAM_ROUTES) {
    if (method !== route.method) {
      continue;
    }
    const match = pathname.match(route.pathPattern);
    if (match) {
      const handler = await resolveHandler(route.handlerKey);
      await dispatchWorkspaceHandler(
        route.handlerKey,
        req,
        res,
        handler,
        deps,
        match[1]!
      );
      return true;
    }
  }

  const allowedMethods = collectWorkspaceRouteMethodsForPath(pathname);
  if (allowedMethods.size > 0 && !allowedMethods.has(method)) {
    const allow = [...allowedMethods].sort().join(", ");
    res.setHeader("Allow", allow);
    sendHttpError(res, 405, { error: "method_not_allowed", code: "METHOD_NOT_ALLOWED" });
    return true;
  }

  return false;
}
