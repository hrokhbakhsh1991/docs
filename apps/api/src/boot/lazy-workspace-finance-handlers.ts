import type { WorkspaceRouteHandlers } from "../http/workspace-route-registrar";
import type { LazyRouteHandlers } from "./lazy-route-handlers";

let workspaceDenaliHandlersPromise: Promise<
  Pick<
    WorkspaceRouteHandlers,
    | "handleGetDenaliCatalog"
    | "handleGetDenaliCatalogTour"
    | "handlePostDenaliRegistration"
    | "handleFinanceSummary"
    | "handleFinanceOpenPayments"
    | "handleFinanceLedgerEvents"
    | "handleFinanceListPayments"
    | "handleFinanceCreateManualPayment"
    | "handleFinanceSubmitReceipt"
    | "handleFinanceReviewReceipt"
    | "handleFinanceReceiptUrl"
    | "handleFinancePendingReceipts"
    | "handleFinanceListPrepayments"
    | "handleFinanceRecordPrepayment"
    | "handleFinanceListSchedules"
    | "handleFinanceGetSchedule"
    | "handleFinanceGenerateSchedule"
    | "handleFinanceGetRegistrationInvoice"
  >
> | null = null;

export function resetLazyWorkspaceFinanceHandlersForTests(): void {
  workspaceDenaliHandlersPromise = null;
}

function loadWorkspaceDenaliHandlers() {
  if (workspaceDenaliHandlersPromise === null) {
    workspaceDenaliHandlersPromise = import("@app-tour/workspace-denali/http").then((mod) => ({
      handleGetDenaliCatalog: mod.handleGetDenaliCatalog,
      handleGetDenaliCatalogTour: mod.handleGetDenaliCatalogTour,
      handlePostDenaliRegistration: mod.handlePostDenaliRegistration,
      handleFinanceSummary: mod.handleFinanceSummary,
      handleFinanceOpenPayments: mod.handleFinanceOpenPayments,
      handleFinanceLedgerEvents: mod.handleFinanceLedgerEvents,
      handleFinanceListPayments: mod.handleFinanceListPayments,
      handleFinanceCreateManualPayment: mod.handleFinanceCreateManualPayment,
      handleFinanceSubmitReceipt: mod.handleFinanceSubmitReceipt,
      handleFinanceReviewReceipt: mod.handleFinanceReviewReceipt,
      handleFinanceReceiptUrl: mod.handleFinanceReceiptUrl,
      handleFinancePendingReceipts: mod.handleFinancePendingReceipts,
      handleFinanceListPrepayments: mod.handleFinanceListPrepayments,
      handleFinanceRecordPrepayment: mod.handleFinanceRecordPrepayment,
      handleFinanceListSchedules: mod.handleFinanceListSchedules,
      handleFinanceGetSchedule: mod.handleFinanceGetSchedule,
      handleFinanceGenerateSchedule: mod.handleFinanceGenerateSchedule,
      handleFinanceGetRegistrationInvoice: mod.handleFinanceGetRegistrationInvoice,
    }));
  }
  return workspaceDenaliHandlersPromise;
}

export async function buildWorkspaceRouteHandlers(
  urbanHandlers: LazyRouteHandlers
): Promise<WorkspaceRouteHandlers> {
  const denaliHandlers = await loadWorkspaceDenaliHandlers();
  return {
    handleGetUrbanSettings: urbanHandlers.handleGetUrbanSettings,
    handlePatchUrbanSettings: urbanHandlers.handlePatchUrbanSettings,
    handleGetUrbanCatalog: urbanHandlers.handleGetUrbanCatalog,
    handleGetUrbanCatalogTour: urbanHandlers.handleGetUrbanCatalogTour,
    handlePostUrbanRegistration: urbanHandlers.handlePostUrbanRegistration,
    ...denaliHandlers,
  };
}
