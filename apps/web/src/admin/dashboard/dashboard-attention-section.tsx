"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import {
  DASHBOARD_WIDGETS_TEST_IDS,
  type DashboardAttentionItem,
} from "@/admin/dashboard/dashboard-widgets-logic";
import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";

type DashboardAttentionSectionProps = {
  readonly items: readonly DashboardAttentionItem[];
};

export function DashboardAttentionSection({ items }: DashboardAttentionSectionProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("dashboard.attention");

  return (
    <section
      data-operator-dashboard-attention
      data-testid={DASHBOARD_WIDGETS_TEST_IDS.attention}
      aria-labelledby="dashboard-attention-title"
    >
      <div data-operator-dashboard-attention-header>
        <h2 id="dashboard-attention-title" data-operator-dashboard-attention-title>
          {t("title")}
        </h2>
      </div>
      {items.length === 0 ? (
        <p
          data-operator-dashboard-attention-clear
          data-testid={DASHBOARD_WIDGETS_TEST_IDS.attentionAllClear}
        >
          {t("allClear")}
        </p>
      ) : (
        <ul
          data-operator-dashboard-attention-list
          data-testid={DASHBOARD_WIDGETS_TEST_IDS.attentionList}
        >
          {items.map((item) => (
            <li
              key={item.id}
              data-operator-dashboard-attention-item
              data-testid={DASHBOARD_WIDGETS_TEST_IDS.attentionItem(item.id)}
            >
              <Link href={item.href} data-operator-dashboard-attention-link>
                <span data-operator-dashboard-attention-label>{t(`items.${item.id}`)}</span>
                <span data-operator-dashboard-attention-count>
                  {t("count", { count: formatLocalizedNumber(item.count, locale) })}
                </span>
                <span data-operator-dashboard-attention-action>{t("open")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
