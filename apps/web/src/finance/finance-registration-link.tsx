"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { financeBookingHref } from "@/finance/finance-booking-href";
import { cn } from "@/lib/utils";

type FinanceRegistrationLinkProps = {
  readonly registrationId: string;
  readonly className?: string;
  /**
   * Human label (member · tour). When omitted, falls back to localized “Open booking”
   * — never use a raw UUID as the visible link text.
   */
  readonly label?: string | null;
  /** @deprecated UUID truncation removed; kept for call-site compatibility. */
  readonly truncate?: boolean;
};

export function FinanceRegistrationLink({
  registrationId,
  className,
  label = null,
}: FinanceRegistrationLinkProps) {
  const t = useTranslations("finance.common");
  const id = registrationId.trim();
  if (id.length === 0) {
    return null;
  }
  const trimmedLabel = label?.trim() ?? "";
  const display = trimmedLabel.length > 0 ? trimmedLabel : t("openBooking");
  return (
    <Link
      href={financeBookingHref(id)}
      title={id}
      className={cn(
        "text-xs text-primary underline-offset-2 hover:underline",
        className
      )}
      data-testid="finance-registration-booking-link"
    >
      {display}
    </Link>
  );
}
