"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { LOCALE_COOKIE_NAME } from "@/i18n/locale-cookie";
import { isAppLocale, routing, type AppLocale } from "@/i18n/routing";

function writeLocaleCookie(locale: AppLocale): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

/** Cookie-driven locale switch (portal uses `localePrefix: never`). */
export function PortalLocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("portalMember.locale");
  const router = useRouter();
  const active = isAppLocale(locale) ? locale : routing.defaultLocale;

  return (
    <div data-portal-locale-switcher data-slot="shell-locale-switcher">
      {routing.locales.map((candidate) => (
        <button
          key={candidate}
          type="button"
          data-locale={candidate}
          aria-pressed={candidate === active}
          disabled={candidate === active}
          onClick={() => {
            if (candidate === active) {
              return;
            }
            writeLocaleCookie(candidate);
            router.refresh();
          }}
        >
          {t(candidate)}
        </button>
      ))}
    </div>
  );
}
