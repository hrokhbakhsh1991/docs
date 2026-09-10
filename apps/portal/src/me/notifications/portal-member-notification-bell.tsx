"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

export function PortalMemberNotificationBell() {
  const t = useTranslations("portalMember.notifications");
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me/notifications/unread-count", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { count?: number };
      setCount(typeof body.count === "number" ? body.count : 0);
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const badge =
    count > 0 ? (
      <span data-portal-member-notification-badge aria-hidden="true">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;

  return (
    <a
      href="/me/notifications"
      data-portal-member-notification-bell
      data-testid="portal-member-notification-bell"
      aria-label={t("bellAria", { count })}
    >
      <Bell aria-hidden="true" />
      {badge}
    </a>
  );
}
