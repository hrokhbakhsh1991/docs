"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { LOCALE_COOKIE_NAME } from "@/i18n/locale-cookie";
import { isAppLocale, resolveMarketingLocalePath, routing, type AppLocale } from "@/i18n/routing";

function writeLocaleCookie(locale: AppLocale): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

export function MarketingLocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("catalog.locale");
  const router = useRouter();
  const pathname = usePathname();
  const active = isAppLocale(locale) ? locale : routing.defaultLocale;

  return (
    <div data-marketing-locale-switcher>
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
            router.push(resolveMarketingLocalePath(pathname, candidate));
          }}
        >
          {t(candidate)}
        </button>
      ))}
    </div>
  );
}
