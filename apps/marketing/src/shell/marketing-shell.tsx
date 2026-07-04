import { LogIn, Menu, Mountain } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import { MarketingFooter } from "./marketing-footer";
import { MARKETING_HEADER_OVERLAY_REQUEST_HEADER } from "./resolve-marketing-header-overlay";

export type MarketingShellProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly portalMemberAreaUrl: string;
  readonly landing: GuestLandingFeatures;
  readonly children: ReactNode;
};

/** Primary nav order: inline-start → inline-end (Home first in RTL = rightmost). */
const FULL_LANDING_NAV_LINKS = [
  { href: "/", key: "nav.home" as const, hook: "home" },
  { href: "/tours", key: "nav.tours" as const, hook: "tours" },
  { href: "/about", key: "nav.about" as const, hook: "about" },
  { href: "/contact", key: "nav.contact" as const, hook: "contact" },
] as const;

export async function MarketingShell({
  branding,
  portalMemberAreaUrl,
  landing,
  children,
}: MarketingShellProps) {
  const t = await getTranslations("catalog");
  const headerList = await headers();
  const title = branding.displayName ?? t("nav.defaultSiteName");
  const isFullLanding = landing.variant === "full";
  const useHeaderOverlay =
    isFullLanding && headerList.get(MARKETING_HEADER_OVERLAY_REQUEST_HEADER) === "1";

  return (
    <>
      {isFullLanding ? (
        <a href="#main-content" data-marketing-skip-link>
          {t("nav.skipToContent")}
        </a>
      ) : null}
      <header
        data-marketing-header
        {...(useHeaderOverlay ? { "data-marketing-header-overlay": true } : {})}
      >
        <div data-marketing-header-inner>
          <Link href="/" data-marketing-brand>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" data-marketing-logo height={36} width={36} />
            ) : (
              <Mountain aria-hidden="true" data-marketing-brand-icon size={28} strokeWidth={2.25} />
            )}
            <span data-marketing-brand-title>{title}</span>
          </Link>

          {isFullLanding ? (
            <nav data-marketing-header-nav aria-label={t("nav.primary")}>
              {FULL_LANDING_NAV_LINKS.map((item) => (
                <Link
                  key={item.hook}
                  href={item.href}
                  data-marketing-nav-link
                  data-marketing-nav-link-id={item.hook}
                >
                  {t(item.key)}
                </Link>
              ))}
            </nav>
          ) : null}

          <div data-marketing-header-end>
            <div data-marketing-header-toolbar>
              <a
                href={portalMemberAreaUrl}
                data-marketing-portal-member
                data-marketing-header-sign-in
                aria-label={t("nav.signIn")}
              >
                <LogIn aria-hidden="true" size={20} strokeWidth={2} />
                <span data-marketing-header-sign-in-label>{t("nav.signIn")}</span>
              </a>
              {isFullLanding ? (
                <Link href="/tours" data-marketing-header-cta>
                  {t("home.full.hero.ctaPrimary")}
                </Link>
              ) : null}
            </div>

            <details data-marketing-nav-drawer>
              <summary data-marketing-nav-drawer-toggle aria-label={t("nav.openMenu")}>
                <Menu aria-hidden="true" size={22} strokeWidth={2.25} />
                <span data-marketing-nav-drawer-toggle-label>{t("nav.openMenu")}</span>
              </summary>
              <nav data-marketing-nav-drawer-panel aria-label={t("nav.primary")}>
                {isFullLanding
                  ? FULL_LANDING_NAV_LINKS.map((item) => (
                      <Link
                        key={item.hook}
                        href={item.href}
                        data-marketing-nav-link
                        data-marketing-nav-link-id={item.hook}
                      >
                        {t(item.key)}
                      </Link>
                    ))
                  : (
                    <Link href="/tours" data-marketing-nav-link data-marketing-nav-link-id="tours">
                      {t("nav.tours")}
                    </Link>
                  )}
                {isFullLanding ? (
                  <Link href="/tours" data-marketing-header-cta>
                    {t("home.full.hero.ctaPrimary")}
                  </Link>
                ) : null}
                <a
                  href={portalMemberAreaUrl}
                  data-marketing-portal-member
                  data-marketing-header-sign-in
                >
                  <LogIn aria-hidden="true" size={18} strokeWidth={2} />
                  {t("nav.signIn")}
                </a>
              </nav>
            </details>
          </div>
        </div>
      </header>
      {children}
      {landing.sections.footer ? (
        <MarketingFooter
          branding={branding}
          portalMemberAreaUrl={portalMemberAreaUrl}
          showFaqLink={landing.sections.faq}
        />
      ) : null}
    </>
  );
}
