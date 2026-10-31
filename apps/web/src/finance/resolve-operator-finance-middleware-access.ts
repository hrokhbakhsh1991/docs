const FINANCE_RECEIPT_REVIEW_PATH = /^\/api\/finance\/receipts\/[^/]+\/review$/;

/** Permit the admin team role to review receipts through the finance BFF only. */
export function allowsOperatorFinanceReceiptReviewTeamAccess(
  role: string | undefined,
  pathname: string,
  method: string
): boolean {
  return (
    role === "admin" &&
    method.toUpperCase() === "PATCH" &&
    FINANCE_RECEIPT_REVIEW_PATH.test(pathname)
  );
}
