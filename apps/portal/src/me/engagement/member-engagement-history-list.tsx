"use client";

import { useTranslations } from "next-intl";

import type { EngagementMemberPointEventHttpItem } from "@app-tour/engagement-http-contracts";

import { formatMemberEngagementTimestamp } from "@/me/engagement/member-engagement-display";

export type MemberEngagementHistoryListProps = {
  readonly items: readonly EngagementMemberPointEventHttpItem[];
  readonly locale: string;
};

export function MemberEngagementHistoryList({ items, locale }: MemberEngagementHistoryListProps) {
  const t = useTranslations("portalMember.engagement");

  return (
    <ul data-portal-member-engagement-history-list>
      {items.map((event) => {
        const label = t.has(event.labelKey) ? t(event.labelKey) : event.labelKey;
        const detailLabel =
          event.detailLabelKey !== null && t.has(event.detailLabelKey)
            ? t(event.detailLabelKey)
            : null;
        const timestamp = formatMemberEngagementTimestamp(event.createdAt, locale);

        if (event.kind === "award") {
          return (
            <li
              key={event.id}
              data-portal-member-engagement-history-item
              data-portal-member-engagement-history-kind="award"
            >
              <div data-portal-member-engagement-history-primary>
                {event.pointsAwarded !== null ? (
                  <span data-portal-member-engagement-history-delta dir="ltr">
                    +{event.pointsAwarded}
                  </span>
                ) : null}
                <span data-portal-member-engagement-history-label>{label}</span>
              </div>
              <time dateTime={event.createdAt} data-portal-member-engagement-history-time>
                {timestamp}
              </time>
            </li>
          );
        }

        return (
          <li
            key={event.id}
            data-portal-member-engagement-history-item
            data-portal-member-engagement-history-kind={event.kind}
          >
            <details data-portal-member-engagement-history-details>
              <summary data-portal-member-engagement-history-summary>
                <span data-portal-member-engagement-history-label>{label}</span>
                <time dateTime={event.createdAt} data-portal-member-engagement-history-time>
                  {timestamp}
                </time>
              </summary>
              {detailLabel !== null ? (
                <p data-portal-member-engagement-history-detail>{detailLabel}</p>
              ) : (
                <p data-portal-member-engagement-history-detail>{label}</p>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
