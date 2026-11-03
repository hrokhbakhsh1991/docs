import { Menu, Mountain } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";
import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import { MarketingShellFrame } from "./marketing-shell-frame";
import { MarketingHeaderAccount } from "./marketing-header-account";
import { MarketingFooter } from "./marketing-footer";
import { MarketingHeaderOverlayScroll } from "./marketing-header-overlay-scroll";
import { MarketingNavDrawerKeyboard } from "./marketing-nav-drawer-keyboard";
import { MarketingLocaleSwitcher } from "@/i18n/marketing-locale-switcher";
import { isAppLocale, resolveMarketingLocalePath, routing } from "@/i18n/routing";
import { MARKETING_HEADER_OVERLAY_REQUEST_HEADER } from "./resolve-marketing-header-overlay";
import type { MarketingMemberHeader } from "./resolve-marketing-member-header.server";
import type { MarketingShellNavItem } from "./resolve-marketing-shell-nav.server";

export type MarketingShellProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly memberHeader: MarketingMemberHeader | null;
  readonly portalMemberLoginUrl: string | null;
  readonly portalMemberModuleUrl: string | null;
  readonly primaryNavLinks: readonly MarketingShellNavItem[];
  readonly landing: GuestLandingFeatures;
  readonly children: ReactNode;
};

export async function MarketingShell({
  branding,
  memberHeader,
  portalMemberLoginUrl,
  portalMemberModuleUrl,
  primaryNavLinks,
  landing,
  children,
}: MarketingShellProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const homeHref = resolveMarketingLocalePath("/", locale);
  const toursHref = resolveMarketingLocalePath("/tours", locale);
  const headerList = await headers();
  const title = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));
  const isFullLanding = landing.variant === "full";
  const navHasToursLink = (isFullLanding ? primaryNavLinks : [{ id: "tours" }]).some(
    (item) => item.id === "tours"
  );
  const showLocaleSwitcher = landing.shellChrome.localeSwitcher;
  const showHeaderToursCta =
    isFullLanding && landing.shellChrome.headerToursCta && !navHasToursLink;
  const useHeaderOverlay =
    isFullLanding && headerList.get(MARKETING_HEADER_OVERLAY_REQUEST_HEADER) === "1";

  return (
    <MarketingShellFrame initiallyAuthenticated={memberHeader !== null}>
      <a href="#main-content" data-marketing-skip-link data-slot="shell-skip-link">
        {t("nav.skipToContent")}
      </a>
      <header
        data-marketing-header
        data-slot="shell-header"
        {...(useHeaderOverlay ? { "data-marketing-header-overlay": true } : {})}
      >
        <div data-marketing-header-inner data-slot="shell-header-inner">
          <Link href={homeHref} data-marketing-brand data-slot="shell-brand">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" data-marketing-logo height={36} width={36} />
            ) : (
              <Mountain aria-hidden="true" data-marketing-brand-icon />
            )}
            <span data-marketing-brand-title>{title}</span>
          </Link>

          <nav data-marketing-header-nav data-slot="shell-nav" aria-label={t("nav.primary")}>
            {(isFullLanding
              ? primaryNavLinks
              : [{ id: "tours", href: toursHref, labelKey: "nav.tours" as const }]
            ).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                prefetch={item.id === "tours" ? false : undefined}
                data-marketing-nav-link
                data-marketing-nav-link-id={item.id}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div data-marketing-header-end data-slot="shell-header-end">
            <div data-marketing-header-toolbar data-slot="shell-toolbar">
              {showLocaleSwitcher ? <MarketingLocaleSwitcher /> : null}
              <MarketingHeaderAccount
                memberHeader={memberHeader}
                loginHref={portalMemberLoginUrl}
                variant="toolbar"
              />
              {showHeaderToursCta ? (
                <Link href={toursHref} prefetch={false} data-marketing-header-cta>
                  {t("home.full.hero.ctaPrimary")}
                </Link>
              ) : null}
            </div>

            <details data-marketing-nav-drawer data-slot="shell-nav-drawer">
              <summary
                data-marketing-nav-drawer-toggle
                data-slot="shell-nav-drawer-toggle"
                aria-label={t("nav.openMenu")}
              >
                <Menu aria-hidden="true" data-marketing-nav-drawer-toggle-icon />
                <span data-marketing-nav-drawer-toggle-label>{t("nav.openMenu")}</span>
              </summary>
              <nav
                data-marketing-nav-drawer-panel
                data-slot={isFullLanding ? "shell-nav-drawer-panel" : "shell-nav"}
                aria-label={t("nav.primary")}
              >
                {isFullLanding ? (
                  primaryNavLinks.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      prefetch={item.id === "tours" ? false : undefined}
                      data-marketing-nav-link
                      data-marketing-nav-link-id={item.id}
                    >
                      {t(item.labelKey)}
                    </Link>
                  ))
                ) : (
                  <Link
                    href={toursHref}
                    prefetch={false}
                    data-marketing-nav-link
                    data-marketing-nav-link-id="tours"
                  >
                    {t("nav.tours")}
                  </Link>
                )}
                <MarketingHeaderAccount
                  memberHeader={memberHeader}
                  loginHref={portalMemberLoginUrl}
                  variant="drawer"
                />
              </nav>
            </details>
            <MarketingNavDrawerKeyboard />
            <MarketingHeaderOverlayScroll />
          </div>
        </div>
      </header>
      <div data-marketing-shell-main data-slot="shell-main" id="main-content">
        {children}
      </div>
      {landing.sections.footer ? (
        <MarketingFooter
          branding={branding}
          portalMemberModuleUrl={portalMemberModuleUrl}
          showFaqLink={landing.sections.faq}
        />
      ) : null}
    </MarketingShellFrame>
  );
}
