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

function isRawTranslationKey(value: string): boolean {
  const trimmed = value.trim();
  return /^(?:notification|portalMember|tickets|settings|nav|common)(?:[._]|$)/u.test(trimmed);
}

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

function resolveNotificationTitle(
  item: NotificationItem,
  locale: string,
  t: ReturnType<typeof useTranslations<"portalMember.notifications">>
): string {
  const localizedTitle = locale.startsWith("fa") ? item.payload?.titleFa : undefined;
  if (
    typeof localizedTitle === "string" &&
    localizedTitle.trim().length > 0 &&
    !isRawTranslationKey(localizedTitle)
  ) {
    return localizedTitle.trim();
  }
  const rawTitle = item.title.trim();
  if (rawTitle.length > 0 && !isRawTranslationKey(rawTitle)) {
    return rawTitle;
  }
  const eventTitleKeys: Record<string, string> = {
    "ticket.created": "eventTitles.ticketCreated",
    "ticket.message.posted": "eventTitles.ticketReply",
    "ticket.internal_note.created": "eventTitles.ticketInternalNote",
    "ticket.status.changed": "eventTitles.ticketStatusChanged",
    "ticket.assigned": "eventTitles.ticketAssigned",
    "ticket.priority.changed": "eventTitles.ticketPriorityChanged",
    "ticket.resolved": "eventTitles.ticketResolved",
    "ticket.reopened": "eventTitles.ticketReopened",
    "registration.approved": "eventTitles.registrationApproved",
    "registration.waitlisted": "eventTitles.registrationWaitlisted",
    "registration.cancelled": "eventTitles.registrationCancelled",
    "registration.rejected": "eventTitles.registrationRejected",
    "payment.hold.scheduled": "eventTitles.paymentScheduled",
    "payment.hold.expired": "eventTitles.paymentExpired",
    "wallet.transaction.posted": "eventTitles.walletUpdated",
    "wallet.balance.updated": "eventTitles.walletUpdated",
    "wallet.refund.credited": "eventTitles.walletUpdated",
  };
  const key = eventTitleKeys[item.eventType];
  return key === undefined ? t("genericTitle") : t(key);
}

function resolveNotificationHref(item: NotificationItem): string {
  if (item.entityType === "ticket" || item.eventType.startsWith("ticket.")) {
    const payloadTicketId =
      typeof item.payload?.ticketId === "string" ? item.payload.ticketId : undefined;
    const ticketId = item.entityId ?? item.ticketId ?? payloadTicketId;
    if (typeof ticketId === "string" && ticketId.length > 0) {
      return `/me/tickets/${encodeURIComponent(ticketId)}`;
    }
  }
  if (item.entityType === "registration") {
    return item.entityId
      ? `/me/registrations/${encodeURIComponent(item.entityId)}`
      : "/me/registrations";
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
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    async (cursor?: string | null) => {
      const isLoadMore = cursor !== undefined && cursor !== null && cursor.length > 0;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const params = new URLSearchParams({ limit: "20" });
      if (isLoadMore) {
        params.set("cursor", cursor);
      }

      try {
        const res = await fetch(`/api/me/notifications?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!isLoadMore) {
            setError(t("loadError"));
            setItems([]);
            setHasMore(false);
            setNextCursor(null);
          }
          return;
        }
        const body = (await res.json()) as ListResponse;
        const pageItems = body.items ?? [];
        if (isLoadMore) {
          setItems((current) => [...current, ...pageItems]);
        } else {
          setItems(pageItems);
        }
        setHasMore(body.hasMore ?? false);
        setNextCursor(body.nextCursor ?? null);
      } catch {
        if (!isLoadMore) {
          setError(t("loadError"));
          setItems([]);
          setHasMore(false);
          setNextCursor(null);
        }
      } finally {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [t]
  );

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
            const title = sanitizeNotificationTitle(resolveNotificationTitle(item, locale, t));
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
            const readOnly = href === "/me/notifications";
            const sourceLabel = resolveSourceLabel(item.sourceModule, t);
            const socialMediaLink =
              item.eventType === "registration.approved" &&
              typeof item.payload?.socialMediaLink === "string" &&
              /^https?:\/\//i.test(item.payload.socialMediaLink)
                ? item.payload.socialMediaLink
                : null;

            return (
              <li
                key={item.id}
                data-portal-member-notification-item={item.id}
                data-portal-member-notification-unread={unread ? "true" : "false"}
                data-portal-member-notification-source={item.sourceModule}
              >
                <div data-portal-member-notification-row-shell>
                  <a
                    href={href}
                    data-portal-member-notification-link
                    aria-describedby={`notification-time-${item.id}`}
                    onClick={(event) => {
                      if (readOnly) {
                        event.preventDefault();
                      }
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
                  {socialMediaLink ? (
                    <span data-portal-member-notification-social-link>
                      <a
                        href={socialMediaLink}
                        target="_blank"
                        rel="noreferrer noopener"
                        data-portal-member-notification-social-link-anchor
                      >
                        {t("openTourSocialLink")}
                      </a>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore ? (
        <button
          type="button"
          data-portal-member-notifications-load-more
          disabled={loadingMore}
          onClick={() => void load(nextCursor)}
        >
          {loadingMore ? t("loadingMore") : t("loadMore")}
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Use MemberNotificationsPanel — cross-domain aggregate inbox. */
export { MemberNotificationsPanel as MemberTicketNotificationsPanel };
