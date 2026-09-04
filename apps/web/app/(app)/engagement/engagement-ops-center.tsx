"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type OverviewPayload = {
  readonly recentPointEvents: readonly {
    readonly userId: string;
    readonly pointsDelta: number;
    readonly sourceEventType: string;
    readonly createdAt: string;
  }[];
  readonly recentBadges: readonly {
    readonly userId: string;
    readonly badgeCode: string;
    readonly labelKey: string;
    readonly earnedAt: string;
  }[];
};

export function EngagementOpsCenter() {
  const t = useTranslations("engagement.ops");
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/engagement/overview", { cache: "no-store" });
      if (!res.ok) {
        if (!cancelled) {
          setError(t("loadFailed"));
        }
        return;
      }
      const payload = (await res.json()) as OverviewPayload;
      if (!cancelled) {
        setOverview(payload);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <main data-operator-engagement-page>
      <header>
        <h1>{t("title")}</h1>
        <p>{t("lede")}</p>
      </header>
      {error ? <p data-operator-engagement-error>{error}</p> : null}
      {overview ? (
        <div data-operator-engagement-grid>
          <section data-operator-engagement-recent-points>
            <h2>{t("recentPoints")}</h2>
            <ul>
              {overview.recentPointEvents.map((event) => (
                <li key={`${event.userId}-${event.createdAt}-${event.sourceEventType}`}>
                  <span>{event.pointsDelta > 0 ? "+" : ""}{event.pointsDelta}</span>
                  <span>{event.sourceEventType}</span>
                  <time dateTime={event.createdAt}>{event.createdAt}</time>
                </li>
              ))}
            </ul>
          </section>
          <section data-operator-engagement-recent-badges>
            <h2>{t("recentBadges")}</h2>
            <ul>
              {overview.recentBadges.map((badge) => (
                <li key={`${badge.userId}-${badge.badgeCode}-${badge.earnedAt}`}>
                  <span>{badge.badgeCode}</span>
                  <time dateTime={badge.earnedAt}>{badge.earnedAt}</time>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <p data-operator-engagement-loading>{t("loading")}</p>
      )}
    </main>
  );
}
