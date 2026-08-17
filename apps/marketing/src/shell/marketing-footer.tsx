import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingLocalePath, routing } from "@/i18n/routing";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";

export type MarketingFooterProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly portalMemberModuleUrl: string | null;
  readonly showFaqLink: boolean;
};

export async function MarketingFooter({
  branding,
  portalMemberModuleUrl,
  showFaqLink,
}: MarketingFooterProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const toursHref = resolveMarketingLocalePath("/tours", locale);
  const faqHref = resolveMarketingLocalePath("/#faq", locale);
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));
  const year = new Date().getFullYear();

  return (
    <footer data-marketing-footer data-slot="footer">
      <div data-marketing-footer-grid>
        <div data-marketing-footer-column>
          <h2>{siteName}</h2>
          <p>{t("home.full.footer.brandLead")}</p>
        </div>
        <div data-marketing-footer-column>
          <h3>{t("home.full.footer.toursTitle")}</h3>
          <ul>
            <li>
              <Link href={toursHref}>{t("home.full.footer.toursBrowse")}</Link>
            </li>
          </ul>
        </div>
        <div data-marketing-footer-column>
          <h3>{t("home.full.footer.resourcesTitle")}</h3>
          <ul>
            {showFaqLink ? (
              <li>
                <Link href={faqHref}>{t("home.full.footer.resourcesFaq")}</Link>
              </li>
            ) : null}
            {portalMemberModuleUrl !== null ? (
              <li>
                <a href={portalMemberModuleUrl}>{t("home.full.footer.resourcesMember")}</a>
              </li>
            ) : null}
          </ul>
        </div>
        <div data-marketing-footer-column>
          <h3>{t("home.full.footer.contactTitle")}</h3>
          <p>{t("home.full.footer.contactLead")}</p>
        </div>
      </div>
      <div data-marketing-footer-newsletter>
        <h3>{t("home.full.footer.newsletterTitle")}</h3>
        <p data-marketing-footer-newsletter-stub>{t("home.full.footer.newsletterStub")}</p>
      </div>
      <p data-marketing-footer-copyright>
        {t("home.full.footer.copyright", { year, siteName })}
      </p>
    </footer>
  );
}
