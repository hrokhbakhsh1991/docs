"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import type { MemberEngagementSummaryView } from "@/me/engagement/member-engagement-bff.server";
import { resolveMemberLevelProgressPercent } from "@/me/engagement/member-engagement-display";

import type { MemberDashboardEngagementProps } from "./member-dashboard-types";

export type { MemberDashboardEngagementProps };

function formatWalletTransactionKind(
  tWallet: ReturnType<typeof useTranslations<"portalMember.wallet">>,
  kind: string | null,
): string {
  if (kind === "operator_credit" || kind === "operator_debit" || kind === "reversal") {
    return tWallet(`transactionKinds.${kind}`);
  }
  return "";
}

function MemberEngagementSummaryCard({
  engagement,
  engagementHref,
}: {
  readonly engagement: MemberEngagementSummaryView;
  readonly engagementHref: string;
}) {
  const t = useTranslations("portalMember.dashboard");
  const tEngagement = useTranslations("portalMember.engagement");
  const progressPercent = resolveMemberLevelProgressPercent({
    totalPoints: engagement.totalPoints,
    currentLevelCode: engagement.currentLevelCode,
    pointsToNextLevel: engagement.pointsToNextLevel,
  });
  const earnedBadges = engagement.badges.filter((badge) => badge.earned);
  const nextBadge = engagement.badges.find((badge) => !badge.earned) ?? null;

  return (
    <div data-portal-member-engagement-summary>
      <p data-portal-member-engagement-not-money>{tEngagement("notMoney")}</p>
      <div data-portal-member-engagement-metrics>
        <div data-portal-member-engagement-points-block>
          <span data-portal-member-engagement-points-label>{tEngagement("pointsLabel")}</span>
          <p data-portal-member-engagement-points>{engagement.totalPoints}</p>
        </div>
        <div data-portal-member-engagement-level-block>
          <span data-portal-member-engagement-level-label>{tEngagement("levelLabel")}</span>
          <p data-portal-member-engagement-level>
            {t(`levels.${engagement.currentLevelCode}`)}
          </p>
        </div>
      </div>
      {progressPercent !== null && engagement.pointsToNextLevel !== null ? (
        <div data-portal-member-engagement-progress-wrap>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={tEngagement("progressAria", { percent: progressPercent })}
            data-portal-member-engagement-progress
          >
            <div
              data-portal-member-engagement-progress-fill
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p data-portal-member-engagement-next-level>
            {t("nextLevelProgress", { points: engagement.pointsToNextLevel })}
          </p>
        </div>
      ) : null}
      <div data-portal-member-engagement-badges-wrap data-portal-member-engagement-badges-region>
        {earnedBadges.length > 0 ? (
          <ul data-portal-member-engagement-badges data-portal-member-engagement-badges-earned>
            {earnedBadges.slice(0, 3).map((badge) => (
              <li
                key={badge.code}
                data-portal-member-engagement-badge
                data-earned="true"
              >
                <span>{t(`badges.${badge.code}.label`)}</span>
                <span data-portal-member-engagement-badge-earned>{t("badgeEarned")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {nextBadge ? (
          <p data-portal-member-engagement-next-badge>
            {tEngagement("nextBadge", {
              badge: t(`badges.${nextBadge.code}.label`),
              percent: nextBadge.progressPercent ?? 0,
            })}
          </p>
        ) : null}
      </div>
      <Link href={engagementHref} data-portal-member-engagement-cta>
        {tEngagement("viewDetails")}
      </Link>
    </div>
  );
}

export function MemberDashboardEngagementPanel({
  engagement,
  wallet,
  openTicketsCount,
  nextTourTitle,
  nextTourDepartureAt,
  profileComplete,
  engagementHref,
  registrationsHref,
  walletHref,
}: MemberDashboardEngagementProps) {
  const t = useTranslations("portalMember.dashboard");
  const tWallet = useTranslations("portalMember.wallet");

  return (
    <div data-portal-member-dashboard-grid>
      <section
        data-portal-member-dashboard-next-tour
        aria-labelledby="portal-dashboard-next-tour-title"
      >
        <h2 id="portal-dashboard-next-tour-title">{t("nextTourTitle")}</h2>
        {nextTourTitle ? (
          <div data-portal-member-next-tour-card>
            <p data-portal-member-next-tour-name>{nextTourTitle}</p>
            {nextTourDepartureAt ? (
              <p data-portal-member-next-tour-date>{nextTourDepartureAt}</p>
            ) : null}
            <a href={registrationsHref} data-portal-member-next-tour-cta>
              {t("viewRegistrations")}
            </a>
          </div>
        ) : (
          <p data-portal-member-next-tour-empty>{t("noUpcomingTour")}</p>
        )}
      </section>

      <section
        data-portal-member-dashboard-engagement
        aria-labelledby="portal-dashboard-engagement-title"
      >
        <div data-portal-member-section-heading>
          <p data-portal-member-home-section-eyebrow>{t("engagementEyebrow")}</p>
          <h2 id="portal-dashboard-engagement-title">{t("engagementTitle")}</h2>
        </div>
        {engagement.enabled ? (
          <MemberEngagementSummaryCard
            engagement={engagement}
            engagementHref={engagementHref}
          />
        ) : (
          <p data-portal-member-engagement-disabled>{t("engagementDisabled")}</p>
        )}
      </section>

      <section
        data-portal-member-dashboard-wallet
        aria-labelledby="portal-dashboard-wallet-title"
        data-portal-member-wallet-state={wallet.state}
      >
        <div data-portal-member-section-heading>
          <p data-portal-member-home-section-eyebrow>{t("walletEyebrow")}</p>
          <h2 id="portal-dashboard-wallet-title">{t("walletTitle")}</h2>
        </div>
        {wallet.state === "ready" ? (
          <div data-portal-member-wallet-summary>
            <p data-portal-member-wallet-balance-label>{tWallet("availableBalance")}</p>
            <p data-portal-member-wallet-dashboard-balance dir="ltr">
              {wallet.balanceLabel}
            </p>
            <p data-portal-member-wallet-currency-hint>
              {tWallet("currencyLabel", { currency: wallet.currency })}
            </p>
            {wallet.lastTransactionLabel !== null ? (
              <p data-portal-member-wallet-last-transaction>
                {t("walletLastTransaction", {
                  amount: wallet.lastTransactionLabel,
                  kind: formatWalletTransactionKind(tWallet, wallet.lastTransactionKind),
                })}
              </p>
            ) : (
              <p data-portal-member-wallet-empty-history>{tWallet("emptyHistory")}</p>
            )}
            <Link href={walletHref} data-portal-member-wallet-cta>
              {t("walletViewDetails")}
            </Link>
          </div>
        ) : wallet.state === "error" ? (
          <p role="alert" data-portal-member-wallet-dashboard-error>
            {t("walletUnavailable")}
          </p>
        ) : null}
      </section>

      <section
        data-portal-member-dashboard-status
        aria-labelledby="portal-dashboard-status-title"
      >
        <h2 id="portal-dashboard-status-title">{t("statusTitle")}</h2>
        <ul data-portal-member-dashboard-status-list>
          <li data-portal-member-profile-status data-complete={profileComplete ? "true" : "false"}>
            {profileComplete ? t("profileComplete") : t("profileIncomplete")}
          </li>
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
