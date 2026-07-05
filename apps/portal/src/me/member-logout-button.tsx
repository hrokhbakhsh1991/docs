"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type JSX } from "react";

export function MemberLogoutButton(): JSX.Element {
  const t = useTranslations("portalMember.nav");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  async function handleLogout(): Promise<void> {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/public-auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      data-public-auth-logout
      data-public-auth-logout-ready={ready ? "true" : undefined}
      disabled={loading || !ready}
      onClick={() => void handleLogout()}
      className="text-sm"
    >
      {loading ? t("loggingOut") : t("logout")}
    </button>
  );
}
