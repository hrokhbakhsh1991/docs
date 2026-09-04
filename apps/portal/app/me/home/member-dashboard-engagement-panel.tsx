"use client";

import { useTranslations } from "next-intl";

import type { MemberEngagementSummaryView } from "@/me/engagement/member-engagement-bff.server";

export type MemberDashboardEngagementProps = {
  readonly engagement: MemberEngagementSummaryView | { readonly enabled: false };
  readonly walletBalanceLabel: string | null;
  readonly openTicketsCount: number | null;
  readonly nextTourTitle: string | null;
  readonly nextTourDepartureAt: string | null;
  readonly profileComplete: boolean;
};

export function MemberDashboardEngagementPanel({
  engagement,
  walletBalanceLabel,
  openTicketsCount,
  nextTourTitle,
  nextTourDepartureAt,
  profileComplete,
}: MemberDashboardEngagementProps) {
  const t = useTranslations("portalMember.dashboard");

  return (
    <div data-portal-member-dashboard-grid>
      <section data-portal-member-dashboard-engagement aria-labelledby="portal-dashboard-engagement-title">
        <div data-portal-member-section-heading>
          <p data-portal-member-home-section-eyebrow>{t("engagementEyebrow")}</p>
          <h2 id="portal-dashboard-engagement-title">{t("engagementTitle")}</h2>
        </div>
        {engagement.enabled ? (
          <div data-portal-member-engagement-summary>
            <p data-portal-member-engagement-points>
              {t("pointsValue", { points: engagement.totalPoints })}
            </p>
            <p data-portal-member-engagement-level>
              {t("levelValue", { level: t(`levels.${engagement.currentLevelCode}`) })}
            </p>
            {engagement.pointsToNextLevel !== null ? (
              <p data-portal-member-engagement-next-level>
                {t("nextLevelProgress", { points: engagement.pointsToNextLevel })}
              </p>
            ) : null}
            <ul data-portal-member-engagement-badges>
              {engagement.badges.map((badge) => (
                <li
                  key={badge.code}
                  data-portal-member-engagement-badge
                  data-earned={badge.earned ? "true" : "false"}
                >
                  <span>{t(`badges.${badge.code}.label`)}</span>
                  {badge.earned ? (
                    <span data-portal-member-engagement-badge-earned>{t("badgeEarned")}</span>
                  ) : badge.progressPercent !== null ? (
                    <span data-portal-member-engagement-badge-progress>
                      {t("badgeProgress", { percent: badge.progressPercent })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p data-portal-member-engagement-disabled>{t("engagementDisabled")}</p>
        )}
      </section>

      <section data-portal-member-dashboard-next-tour aria-labelledby="portal-dashboard-next-tour-title">
        <h2 id="portal-dashboard-next-tour-title">{t("nextTourTitle")}</h2>
        {nextTourTitle ? (
          <div data-portal-member-next-tour-card>
            <p data-portal-member-next-tour-name>{nextTourTitle}</p>
            {nextTourDepartureAt ? (
              <p data-portal-member-next-tour-date>{nextTourDepartureAt}</p>
            ) : null}
            <a href="/me/registrations" data-portal-member-next-tour-cta>
              {t("viewRegistrations")}
            </a>
          </div>
        ) : (
          <p data-portal-member-next-tour-empty>{t("noUpcomingTour")}</p>
        )}
      </section>

      <section data-portal-member-dashboard-status aria-labelledby="portal-dashboard-status-title">
        <h2 id="portal-dashboard-status-title">{t("statusTitle")}</h2>
        <ul data-portal-member-dashboard-status-list>
          <li data-portal-member-profile-status data-complete={profileComplete ? "true" : "false"}>
            {profileComplete ? t("profileComplete") : t("profileIncomplete")}
          </li>
          {walletBalanceLabel !== null ? (
            <li data-portal-member-wallet-status>
              {t("walletSeparate", { balance: walletBalanceLabel })}
            </li>
          ) : null}
          {openTicketsCount !== null ? (
            <li data-portal-member-tickets-status>
              {t("openTickets", { count: openTicketsCount })}
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
