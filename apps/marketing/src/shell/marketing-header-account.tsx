"use client";

import { LogIn, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMarketingSession } from "@/auth/marketing-session-context";
import type { MarketingMemberHeader } from "./marketing-member-header";

export function MarketingHeaderAccount({
  memberHeader,
  loginHref,
  variant,
}: {
  readonly memberHeader: MarketingMemberHeader | null;
  readonly loginHref: string | null;
  readonly variant: "toolbar" | "drawer";
}) {
  const t = useTranslations("catalog");
  const session = useMarketingSession();
  const authenticated = session?.authenticated ?? memberHeader !== null;
  const profileHref = session?.profileHref ?? memberHeader?.profileHref;
  if (authenticated && profileHref) {
    return (
      <a
        href={profileHref}
        data-marketing-portal-member
        data-marketing-header-member
        data-marketing-header-account
        aria-label={variant === "toolbar" ? t("nav.account") : undefined}
      >
        <span data-marketing-header-member-avatar-wrap>
          {memberHeader?.avatarUrl ? (
            <img
              src={memberHeader.avatarUrl}
              alt=""
              data-marketing-header-member-avatar
              height={32}
              width={32}
            />
          ) : (
            <User aria-hidden="true" data-marketing-header-member-icon />
          )}
        </span>
        <span data-marketing-header-member-meta>
          <span data-marketing-header-member-label>
            {memberHeader?.displayName ?? t("nav.memberFallback")}
          </span>
          <span data-marketing-header-member-hint>{t("nav.account")}</span>
        </span>
      </a>
    );
  }
  if (loginHref === null) return null;
  return (
    <a
      href={loginHref}
      data-marketing-portal-member
      data-marketing-header-sign-in
      aria-label={variant === "toolbar" ? t("nav.signIn") : undefined}
    >
      <LogIn aria-hidden="true" data-marketing-header-sign-in-icon />
      {variant === "toolbar" ? (
        <span data-marketing-header-sign-in-label>{t("nav.signIn")}</span>
      ) : (
        t("nav.signIn")
      )}
    </a>
  );
}
