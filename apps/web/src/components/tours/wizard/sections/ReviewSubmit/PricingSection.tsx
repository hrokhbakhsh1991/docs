"use client";

import type { ReactNode } from "react";

type Props = {
  participation?: {
    minParticipants?: number;
  };
  pricing?: {
    basePrice?: number;
    requiresPayment?: boolean;
  };
  autoAcceptRegistrations?: boolean;
  showRequiresPayment?: boolean;
  SummaryRow: (props: { label: string; value: ReactNode }) => JSX.Element;
};

export function PricingSection({
  participation,
  pricing,
  autoAcceptRegistrations,
  showRequiresPayment = false,
  SummaryRow,
}: Props) {
  return (
    <section>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>ظرفیت و قیمت</h3>
      <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
        <SummaryRow
          label="حداقل ظرفیت"
          value={participation?.minParticipants?.toLocaleString?.("fa-IR") ?? participation?.minParticipants}
        />
        <SummaryRow
          label="قیمت پایه (تومان)"
          value={pricing?.basePrice?.toLocaleString?.("fa-IR") ?? pricing?.basePrice}
        />
        <SummaryRow
          label="پذیرش ثبت‌نام"
          value={
            autoAcceptRegistrations !== false
              ? "خودکار — بدون تأیید دستی"
              : "دستی — نیاز به تأیید راهبر"
          }
        />
        {showRequiresPayment ? (
          <SummaryRow
            label="پرداخت آنلاین"
            value={pricing?.requiresPayment === true ? "الزامی پس از ثبت‌نام" : "اختیاری / بدون intent خودکار"}
          />
        ) : null}
      </dl>
    </section>
  );
}
