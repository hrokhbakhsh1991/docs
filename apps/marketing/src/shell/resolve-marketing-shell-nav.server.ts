import {
  resolveGuestCrossSurfaceNav,
  type GuestCrossSurfaceNavLink,
} from "@app-tour/workspace-sdk";
import type { AppLocale } from "@/i18n/routing";
import { resolveMarketingLocalePath } from "@/i18n/routing";
import { resolvePortalMemberModuleUrl } from "@app-tour/guest-surface-host";

import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";

export type MarketingShellNavItem = {
  readonly id: string;
  readonly href: string;
  readonly labelKey: string;
};

const CLUB_FALLBACK_NAV: readonly MarketingShellNavItem[] = Object.freeze([
  Object.freeze({ id: "home", href: "/", labelKey: "nav.home" }),
  Object.freeze({ id: "tours", href: "/tours", labelKey: "nav.tours" }),
]);

function isLinkVisible(host: string, link: GuestCrossSurfaceNavLink): boolean {
  const visibleWhen = link.visibleWhen ?? "club";
  if (visibleWhen === "always") {
    return true;
  }
  const isMother = isPlatformMotherHost(host);
  if (visibleWhen === "platform_mother") {
    return isMother;
  }
  return !isMother;
}

function resolveCrossSurfaceHref(host: string, link: GuestCrossSurfaceNavLink): string {
  if (link.surface === "marketing") {
    return link.path ?? "/";
  }
  switch (link.egress) {
    case "member_module":
      return resolvePortalMemberModuleUrl(host, link.memberModuleId) ?? "/";
    case "marketing_home":
      return "/";
    case "marketing_tours":
      return "/tours";
    default:
      return resolvePortalMemberModuleUrl(host, link.memberModuleId) ?? "/";
  }
}

/** Manifest-driven primary nav for marketing shell (PS-4 / PS-6 memberModuleId). */
export function resolveMarketingShellNavLinks(
  host: string,
  pluginId: string,
  locale: AppLocale
): readonly MarketingShellNavItem[] {
  const surface = resolveGuestCrossSurfaceNav(pluginId);
  if (surface === null) {
    return Object.freeze(
      CLUB_FALLBACK_NAV.map((item) =>
        Object.freeze({
          ...item,
          href: resolveMarketingLocalePath(item.href, locale),
        })
      )
    );
  }

  return Object.freeze(
    surface.links
      .filter((link) => isLinkVisible(host, link))
      .map((link) =>
        Object.freeze({
          id: link.id,
          labelKey: link.labelKey,
          href: resolveMarketingLocalePath(resolveCrossSurfaceHref(host, link), locale),
        })
      )
  );
}
