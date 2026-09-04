import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import {
  fetchMemberEngagementPointHistory,
  fetchMemberEngagementSummary,
} from "@/me/engagement/member-engagement-bff.server";
import { MemberEngagementHistoryList } from "@/me/engagement/member-engagement-history-list";
import { MemberModuleEntitlementGate } from "@/me/member-module-entitlement-gate";
import { resolveMemberPortalHomePath } from "@/me/resolve-member-portal-routes.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portalMember.engagement");
  return { title: t("title") };
}

export default async function MemberEngagementPage() {
  const t = await getTranslations("portalMember.engagement");
  const tDashboard = await getTranslations("portalMember.dashboard");
  const locale = await getLocale();
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const homeHref = resolveMemberPortalHomePath(bootstrap.pluginId);

  const [summaryResult, historyResult] = await Promise.all([
    fetchMemberEngagementSummary(host),
    fetchMemberEngagementPointHistory(host),
  ]);

  const summary =
    summaryResult.ok && "enabled" in summaryResult.view && summaryResult.view.enabled
      ? summaryResult.view
      : null;

  return (
    <MemberModuleEntitlementGate host={host} bootstrap={bootstrap} moduleId="home">
      <main data-portal-member-engagement-page>
        <header data-portal-member-page-header>
          <Link href={homeHref} data-portal-member-engagement-back>
            {t("backToHome")}
          </Link>
          <h1>{t("title")}</h1>
          <p data-portal-member-engagement-lede>{t("lede")}</p>
          <p data-portal-member-engagement-not-money>{t("notMoney")}</p>
        </header>

        {summary === null || !historyResult.ok ? (
          <p role="alert" data-portal-member-engagement-error>
            {t("loadFailed")}
          </p>
        ) : (
          <>
            <section
              data-portal-member-engagement-detail-summary
              aria-labelledby="portal-engagement-summary-heading"
            >
              <h2 id="portal-engagement-summary-heading">{tDashboard("engagementTitle")}</h2>
              <div data-portal-member-engagement-metrics>
                <div data-portal-member-engagement-points-block>
                  <span data-portal-member-engagement-points-label>{t("pointsLabel")}</span>
                  <p data-portal-member-engagement-points>{summary.totalPoints}</p>
                </div>
                <div data-portal-member-engagement-level-block>
                  <span data-portal-member-engagement-level-label>{t("levelLabel")}</span>
                  <p data-portal-member-engagement-level>
                    {tDashboard(`levels.${summary.currentLevelCode}`)}
                  </p>
                </div>
              </div>
            </section>

            <section
              data-portal-member-engagement-history
              aria-labelledby="portal-engagement-history-heading"
            >
              <h2 id="portal-engagement-history-heading">{t("historyTitle")}</h2>
              {historyResult.items.length === 0 ? (
                <p data-portal-member-engagement-empty-history>{t("emptyHistory")}</p>
              ) : (
                <MemberEngagementHistoryList items={historyResult.items} locale={locale} />
              )}
            </section>

            <section
              data-portal-member-engagement-badges-section
              aria-labelledby="portal-engagement-badges-heading"
            >
              <h2 id="portal-engagement-badges-heading">{t("badgesTitle")}</h2>
              {summary.badges.every((badge) => !badge.earned) ? (
                <p data-portal-member-engagement-empty-badges>{t("emptyBadges")}</p>
              ) : (
                <ul data-portal-member-engagement-badges>
                  {summary.badges.map((badge) => (
                    <li
                      key={badge.code}
                      data-portal-member-engagement-badge
                      data-earned={badge.earned ? "true" : "false"}
                    >
                      <span>{tDashboard(`badges.${badge.code}.label`)}</span>
                      {badge.earned ? (
                        <span data-portal-member-engagement-badge-earned>
                          {tDashboard("badgeEarned")}
                        </span>
                      ) : badge.progressPercent !== null ? (
                        <span data-portal-member-engagement-badge-progress>
                          {tDashboard("badgeProgress", { percent: badge.progressPercent })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </MemberModuleEntitlementGate>
  );
}
