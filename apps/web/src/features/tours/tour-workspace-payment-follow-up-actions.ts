import type { PaymentScheduleItem } from "@/finance/finance-installments-logic";
import type { TourWorkspacePaymentSummaryStatus } from "@/features/tours/tour-workspace-payment-follow-up-state";

export type TourWorkspaceDetailActionMode = "active" | "review_receipt" | "read_only";

export type TourWorkspaceDetailActionRecommendation = {
  readonly titleKey:
    | "detailRecommendationReviewReceiptTitle"
    | "detailRecommendationScheduleTitle"
    | "detailRecommendationCollectTitle"
    | "detailRecommendationSettledTitle";
  readonly bodyKey:
    | "detailRecommendationReviewReceiptBody"
    | "detailRecommendationScheduleBody"
    | "detailRecommendationCollectBody"
    | "detailRecommendationSettledBody";
};

export function hasActiveTourWorkspacePaymentSchedule(
  schedule: readonly PaymentScheduleItem[]
): boolean {
  return schedule.some((item) => item.status !== "paid" && item.status !== "waived");
}

export function resolveTourWorkspaceDetailActionRecommendation(input: {
  readonly status: TourWorkspacePaymentSummaryStatus;
  readonly hasActiveSchedule: boolean;
}): TourWorkspaceDetailActionRecommendation {
  if (input.status === "payment_under_review") {
    return {
      titleKey: "detailRecommendationReviewReceiptTitle",
      bodyKey: "detailRecommendationReviewReceiptBody",
    };
  }
  if (input.status === "paid_in_full" || input.status === "no_payment_required") {
    return {
      titleKey: "detailRecommendationSettledTitle",
      bodyKey: "detailRecommendationSettledBody",
    };
  }
  if (input.hasActiveSchedule) {
    return {
      titleKey: "detailRecommendationScheduleTitle",
      bodyKey: "detailRecommendationScheduleBody",
    };
  }
  return {
    titleKey: "detailRecommendationCollectTitle",
    bodyKey: "detailRecommendationCollectBody",
  };
}

export function resolveTourWorkspaceDetailActionMode(
  status: TourWorkspacePaymentSummaryStatus
): TourWorkspaceDetailActionMode {
  if (status === "payment_under_review") {
    return "review_receipt";
  }
  if (
    status === "paid_in_full" ||
    status === "no_payment_required" ||
    status === "credit_balance"
  ) {
    return "read_only";
  }
  return "active";
}
