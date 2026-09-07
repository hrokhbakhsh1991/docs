"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import {
  formatMemberNotificationDateTime,
  formatMemberNotificationRelativeTime,
  resolveNotificationBodyForLocale,
  resolveNotificationSourceIcon,
  sanitizeNotificationTitle,
} from "@/me/notifications/member-notifications-format";

type NotificationItem = {
  readonly id: string;
  readonly sourceModule: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly ticketId?: string;
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly readAt: string | null;
  readonly createdAt: string;
  readonly payload?: Readonly<Record<string, unknown>>;
};

type ListResponse = {
  readonly items?: readonly NotificationItem[];
  readonly hasMore?: boolean;
  readonly nextCursor?: string | null;
};

function resolveLocalizedCopy(
  item: NotificationItem,
  locale: string
): { title: string; body: string } {
  const payload = item.payload ?? {};
  if (locale.startsWith("fa")) {
    const titleFa = typeof payload.titleFa === "string" ? payload.titleFa : item.title;
    const bodyFa = typeof payload.bodyFa === "string" ? payload.bodyFa : item.body;
    return { title: titleFa, body: bodyFa };
  }
  return { title: item.title, body: item.body };
}

function resolveNotificationHref(item: NotificationItem): string {
  if (item.entityType === "ticket") {
    const ticketId = item.entityId ?? item.ticketId;
    if (typeof ticketId === "string" && ticketId.length > 0) {
      return `/me/tickets/${ticketId}`;
    }
  }
  if (item.entityType === "registration") {
    return "/me/registrations";
  }
  if (item.entityType === "payment") {
    return "/me/registrations";
  }
  if (item.entityType === "wallet_event") {
    return "/me/wallet";
  }
  return "/me/notifications";
}

function resolveSourceLabel(
  sourceModule: string,
  t: ReturnType<typeof useTranslations<"portalMember.notifications">>
): string {
  const knownSources: Record<
    string,
    | "sources.ticketing"
    | "sources.wallet"
    | "sources.finance"
    | "sources.engagement"
    | "sources.booking"
  > = {
    ticketing: "sources.ticketing",
    wallet: "sources.wallet",
    finance: "sources.finance",
    engagement: "sources.engagement",
    booking: "sources.booking",
  };
  const key = knownSources[sourceModule] ?? "sources.default";
  return t(key);
}

export function MemberNotificationsPanel() {
  const t = useTranslations("portalMember.notifications");
  const locale = useLocale();
  const [items, setItems] = useState<readonly NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/notifications?limit=20", { cache: "no-store" });
      if (!res.ok) {
        setError(t("loadError"));
        setItems([]);
        return;
      }
      const body = (await res.json()) as ListResponse;
      setItems(body.items ?? []);
    } catch {
      setError(t("loadError"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (notificationId: string): Promise<void> => {
    await fetch(`/api/me/notifications/${notificationId}/read`, {
      method: "PATCH",
      cache: "no-store",
    });
    setItems((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
          : item
      )
    );
  };

  const markAllRead = async (): Promise<void> => {
    setMarkingAll(true);
    try {
      await fetch("/api/me/notifications/mark-all-read", {
        method: "POST",
        cache: "no-store",
      });
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        }))
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((item) => item.readAt === null).length;

  if (loading) {
    return (
      <div data-portal-member-notifications-panel data-portal-member-notifications-state="loading">
        <div data-portal-member-notifications-skeleton aria-busy="true" aria-live="polite">
          <div data-portal-member-notifications-skeleton-row />
          <div data-portal-member-notifications-skeleton-row />
          <div data-portal-member-notifications-skeleton-row />
        </div>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div data-portal-member-notifications-panel data-portal-member-notifications-state="error">
        <div data-portal-member-notifications-error role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-portal-member-notifications-panel data-portal-member-notifications-state="ready">
      {unreadCount > 0 ? (
        <div data-portal-member-notifications-toolbar>
          <span data-portal-member-notifications-unread-summary>
            {t("unreadSummary", { count: unreadCount })}
          </span>
          <button
            type="button"
            data-portal-member-notifications-mark-all
            disabled={markingAll}
            onClick={() => void markAllRead()}
          >
            {markingAll ? t("markingAllRead") : t("markAllRead")}
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div data-portal-member-notifications-empty>
          <h2>{t("emptyTitle")}</h2>
          <p>{t("emptyBody")}</p>
        </div>
      ) : (
        <ul data-portal-member-notifications-list>
          {items.map((item) => {
            const copy = resolveLocalizedCopy(item, locale);
            const title = sanitizeNotificationTitle(copy.title);
            const body = resolveNotificationBodyForLocale({
              title,
              body: copy.body,
              locale,
              entityId: item.entityId,
              ticketFallback: (ticketRef) => t("ticketUpdateBody", { ticketRef }),
              genericFallback: t("genericUpdateBody"),
            });
            const unread = item.readAt === null;
            const Icon = resolveNotificationSourceIcon(item.sourceModule, item.eventType);
            const href = resolveNotificationHref(item);
            const sourceLabel = resolveSourceLabel(item.sourceModule, t);

            return (
              <li
                key={item.id}
                data-portal-member-notification-item={item.id}
                data-portal-member-notification-unread={unread ? "true" : "false"}
                data-portal-member-notification-source={item.sourceModule}
              >
                <a
                  href={href}
                  data-portal-member-notification-link
                  aria-describedby={`notification-time-${item.id}`}
                  onClick={() => {
                    if (unread) void markRead(item.id);
                  }}
                >
                  <span data-portal-member-notification-icon aria-hidden="true">
                    <Icon />
                  </span>
                  <span data-portal-member-notification-content>
                    <span data-portal-member-notification-row>
                      <strong data-portal-member-notification-title>{title}</strong>
                      {unread ? (
                        <span data-portal-member-notification-unread-dot aria-hidden="true" />
                      ) : null}
                    </span>
                    <span data-portal-member-notification-source-chip>{sourceLabel}</span>
                    {body.length > 0 ? (
                      <span data-portal-member-notification-body>{body}</span>
                    ) : null}
                    <time
                      id={`notification-time-${item.id}`}
                      dateTime={item.createdAt}
                      data-portal-member-notification-time
                      title={formatMemberNotificationDateTime(item.createdAt, locale)}
                    >
                      {formatMemberNotificationRelativeTime(item.createdAt, locale)}
                    </time>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** @deprecated Use MemberNotificationsPanel — cross-domain aggregate inbox. */
export { MemberNotificationsPanel as MemberTicketNotificationsPanel };
