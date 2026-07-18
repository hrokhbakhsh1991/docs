import type { IncomingMessage, ServerResponse } from "node:http";

import { resolveLazyFinanceService } from "../boot/lazy-finance-service";
import type { FinanceService } from "../workspace-finance/finance.service";
import type { TourStorageRepository } from "../db/tour.repository";
import { getIdentityRepository } from "../identity/create-identity-repository";
import { MembershipNotFoundError } from "../identity/in-memory-identity.repository";
import {
  WORKSPACE_HTTP_PARAM_ROUTES,
  WORKSPACE_HTTP_STATIC_ROUTES,
  type WorkspaceHttpHandlerKey,
} from "./workspace-http-routes.generated";

/** Generic HTTP handler invoked by workspace route dispatch. */
export type WorkspaceHttpHandlerFn = (
  req: IncomingMessage,
  res: ServerResponse,
  ...args: unknown[]
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
  handleFinanceGetSchedule: "finance-param",
  handleFinanceLedgerEvents: "finance",
  handleFinanceListPayments: "finance",
  handleFinanceListPrepayments: "finance",
  handleFinanceListBookingSyncDegraded: "finance",
  handleFinanceListSchedules: "finance",
  handleFinanceOpenPayments: "finance",
  handleFinancePendingReceipts: "finance",
  handleFinanceReceiptUrl: "finance-param",
  handleFinanceRecordPrepayment: "finance",
  handleFinanceRetryBookingSync: "finance",
  handleFinanceReviewReceipt: "finance-param",
  handleFinanceSubmitReceipt: "finance",
  handleFinanceSummary: "finance",
  handleGetDenaliCatalog: "product",
  handleGetDenaliCatalogTour: "product-param",
  handleGetDenaliDashboardTour: "product-param",
  handleGetDenaliReminderFeed: "product",
  handleGetGuestClubCatalog: "bare",
  handleGetGuestClubCatalogTour: "product-param",
  handleGetUrbanCatalog: "product",
  handleGetUrbanCatalogTour: "product-param",
  handleGetUrbanSettings: "bare",
  handlePatchUrbanSettings: "bare",
  handlePostDenaliRegistration: "product",
  handlePostGuestClubRegistration: "bare",
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

async function financeRouteDeps(
  deps: WorkspaceRouteRegistrarDeps
): Promise<{ financeService: FinanceService }> {
  return { financeService: await resolveLazyFinanceService(deps.financeService) };
}

async function dispatchWorkspaceHandler(
  handlerKey: WorkspaceHttpHandlerKey,
  req: IncomingMessage,
  res: ServerResponse,
  handlers: WorkspaceRouteHandlers,
  deps: WorkspaceRouteRegistrarDeps,
  pathParam?: string
): Promise<void> {
  const handler = handlers[handlerKey];
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
      await handler(req, res, await financeRouteDeps(deps));
      return;
    case "finance-param":
      await handler(req, res, await financeRouteDeps(deps), pathParam!);
      return;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`WORKSPACE_HTTP_DISPATCH_UNKNOWN:${String(_exhaustive)}`);
    }
  }
}

/**
 * Dispatches workspace-product HTTP routes (urban + denali finance). Returns true when handled.
 */
export async function tryDispatchWorkspaceRoutes(
  method: string,
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
  handlers: WorkspaceRouteHandlers,
  deps: WorkspaceRouteRegistrarDeps
): Promise<boolean> {
  for (const route of WORKSPACE_HTTP_STATIC_ROUTES) {
    if (method === route.method && pathname === route.path) {
      await dispatchWorkspaceHandler(route.handlerKey, req, res, handlers, deps);
      return true;
    }
  }

  for (const route of WORKSPACE_HTTP_PARAM_ROUTES) {
    if (method !== route.method) {
      continue;
    }
    const match = pathname.match(route.pathPattern);
    if (match) {
      await dispatchWorkspaceHandler(route.handlerKey, req, res, handlers, deps, match[1]!);
      return true;
    }
  }

  return false;
}
