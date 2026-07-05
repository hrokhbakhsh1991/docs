import { LogIn, Menu, Mountain } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import { MarketingFooter } from "./marketing-footer";
import { MARKETING_HEADER_OVERLAY_REQUEST_HEADER } from "./resolve-marketing-header-overlay";
import type { MarketingShellNavItem } from "./resolve-marketing-shell-nav.server";

export type MarketingShellProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly portalMemberModuleUrl: string;
  readonly primaryNavLinks: readonly MarketingShellNavItem[];
  readonly landing: GuestLandingFeatures;
  readonly children: ReactNode;
};

export async function MarketingShell({
  branding,
  portalMemberModuleUrl,
  primaryNavLinks,
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
              {primaryNavLinks.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  data-marketing-nav-link
                  data-marketing-nav-link-id={item.id}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
          ) : null}

          <div data-marketing-header-end>
            <div data-marketing-header-toolbar>
              <a
                href={portalMemberModuleUrl}
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
                  ? primaryNavLinks.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        data-marketing-nav-link
                        data-marketing-nav-link-id={item.id}
                      >
                        {t(item.labelKey)}
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
                  href={portalMemberModuleUrl}
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
          portalMemberModuleUrl={portalMemberModuleUrl}
          showFaqLink={landing.sections.faq}
        />
      ) : null}
    </>
  );
}
