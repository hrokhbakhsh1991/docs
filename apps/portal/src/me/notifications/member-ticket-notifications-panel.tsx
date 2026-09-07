"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

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

const EVENT_MESSAGE_KEYS: Readonly<
  Record<string, { readonly title: string; readonly body: string }>
> = {
  "wallet.transaction.posted": {
    title: "events.wallet.transaction.posted.title",
    body: "events.wallet.transaction.posted.body",
  },
  "wallet.balance.updated": {
    title: "events.wallet.balance.updated.title",
    body: "events.wallet.balance.updated.body",
  },
  "wallet.refund.credited": {
    title: "events.wallet.refund.credited.title",
    body: "events.wallet.refund.credited.body",
  },
};

function resolveLocalizedCopy(
  item: NotificationItem,
  locale: string,
  translate: (key: string) => string,
): { title: string; body: string } {
  const payload = item.payload ?? {};
  const messageKeys = EVENT_MESSAGE_KEYS[item.eventType];
  if (messageKeys !== undefined) {
    return {
      title: translate(messageKeys.title),
      body: translate(messageKeys.body),
    };
  }
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
    return "/me/bookings";
  }
  if (item.entityType === "payment") {
    return "/me/bookings";
  }
  if (item.entityType === "wallet_event") {
    return "/me/wallet";
  }
  return "/me/notifications";
}

export function MemberNotificationsPanel() {
  const t = useTranslations("portalMember.notifications");
  const locale = useLocale();
  const [items, setItems] = useState<readonly NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          : item,
      ),
    );
  };

  const markAllRead = async (): Promise<void> => {
    await fetch("/api/me/notifications/mark-all-read", {
      method: "POST",
      cache: "no-store",
    });
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
  };

  if (loading) {
    return (
      <div data-portal-member-notifications data-portal-member-notifications-state="loading">
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div data-portal-member-notifications data-portal-member-notifications-state="error">
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div data-portal-member-notifications data-portal-member-notifications-state="ready">
      <header data-portal-member-notifications-header>
        <h1>{t("title")}</h1>
        <p>{t("lede")}</p>
        {items.some((item) => item.readAt === null) ? (
          <button type="button" onClick={() => void markAllRead()}>
            {t("markAllRead")}
          </button>
        ) : null}
      </header>

      {items.length === 0 ? (
        <p data-portal-member-notifications-empty>{t("empty")}</p>
      ) : (
        <ul data-portal-member-notifications-list>
          {items.map((item) => {
            const copy = resolveLocalizedCopy(item, locale, (key) => t(key as "events.wallet.transaction.posted.title"));
            const unread = item.readAt === null;
            return (
              <li
                key={item.id}
                data-portal-member-notification-item={item.id}
                data-portal-member-notification-unread={unread ? "true" : "false"}
                data-portal-member-notification-source={item.sourceModule}
              >
                <a
                  href={resolveNotificationHref(item)}
                  onClick={() => {
                    if (unread) void markRead(item.id);
                  }}
                >
                  <strong>{copy.title}</strong>
                  <span>{copy.body}</span>
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
