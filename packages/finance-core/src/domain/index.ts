/**
 * Domain public barrel — explicit only (Phase 2.3.3).
 */
export type {
  GenerateScheduleTemplate,
  InstallmentItemStatus,
  PaymentScheduleItem,
  PrepaymentRecord,
} from "./schedule";
export { buildPaymentScheduleItems } from "./schedule";
export {
  compileRegistrationInvoice,
  type CompileInvoiceBalancesInput,
  type RegistrationInvoiceReadModel,
} from "./compile-invoice-balances";
export {
  attachFinanceRegistrationContext,
  filterRowsByRegistrationId,
  type FinanceRegistrationContext,
} from "./finance-registration-context";
