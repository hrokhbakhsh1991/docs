"use client";

import { useLocale, useTranslations } from "next-intl";

import {
  hasVisibleMemberDiscount,
  type RegistrationCommercialPricingDisplay,
} from "@/finance/finance-commercial-pricing-logic";
import { formatMinorAmount } from "@/finance/finance-prepayments-logic";
import { OPERATOR_WARNING_TEXT_CLASS } from "@/admin/patterns/operator-semantic-surfaces";
import type { AppLocale } from "@/i18n/routing";

type FinanceCommercialPricingBreakdownProps = {
  readonly pricing: RegistrationCommercialPricingDisplay;
  readonly currency: string;
  readonly className?: string;
  readonly showBlockedWarning?: boolean;
};

export function FinanceCommercialPricingBreakdown({
  pricing,
  currency,
  className,
  showBlockedWarning = true,
}: FinanceCommercialPricingBreakdownProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("finance.commercialPricing");
  const showDiscount = hasVisibleMemberDiscount(pricing);
  const resolvedCurrency = currency.length > 0 ? currency : pricing.currency;

  return (
    <div className={className} data-finance-commercial-pricing-breakdown>
      <div data-finance-commercial-pricing-row="gross">
        <span>{t("gross")}</span>
        <strong>{formatMinorAmount(pricing.grossMinor, resolvedCurrency, locale)}</strong>
      </div>
      {showDiscount ? (
        <div data-finance-commercial-pricing-row="membership-discount">
          <span>
            {t("membershipDiscount", {
              percent: pricing.memberDiscountPercentage ?? 0,
            })}
          </span>
          <strong>
            −{formatMinorAmount(pricing.memberDiscountMinor, resolvedCurrency, locale)}
          </strong>
        </div>
      ) : null}
      <div data-finance-commercial-pricing-row="payable">
        <span>{t("payable")}</span>
        <strong>{formatMinorAmount(pricing.payableMinor, resolvedCurrency, locale)}</strong>
      </div>
      {showBlockedWarning && pricing.membershipDiscountBlocked === true ? (
        <p className={OPERATOR_WARNING_TEXT_CLASS} data-finance-membership-discount-blocked>
          {t("membershipDiscountBlocked", {
            percent: pricing.memberPermanentDiscountPercentage ?? 0,
          })}
        </p>
      ) : null}
    </div>
  );
}
