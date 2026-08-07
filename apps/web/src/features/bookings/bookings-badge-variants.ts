import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "@/components/ui/badge";
import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function bookingStatusBadgeVariant(status: BookingListItem["status"]): BadgeVariant {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
    case "waitlisted":
      return "warning";
    case "cancelled":
    case "rejected":
      return "destructive";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function bookingPaymentBadgeVariant(
  paymentStatus: BookingListItem["paymentStatus"]
): BadgeVariant {
  switch (paymentStatus) {
    case "paid":
      return "success";
    case "partial":
      return "warning";
    case "unpaid":
      return "outline";
    default: {
      const exhaustive: never = paymentStatus;
      return exhaustive;
    }
  }
}
