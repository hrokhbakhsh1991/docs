import type { Metadata } from "next";
import { registerWorkspacePluginSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { isAppLocale, resolveTextDirection, routing } from "@/i18n/routing";
import { inter, resolveAppFontClassName, resolveAppFontFamilyCss, vazirmatn, calistoga } from "@/i18n/app-fonts";
import { PortalProviders } from "@/shell/portal-providers";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { importGuestPortalThemeForPlugin } from "@app-tour/guest-workspace-runtime/themes/portal";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";

import { ensureMemberWalletRendererRegistered } from "@/me/wallet/register-member-wallet-renderer.server";

import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = await readPortalIngressHost();
  const branding = await fetchPublicTenantBrandingForHost(host);
  const t = await getTranslations("catalogRegistration");
  const siteName = resolveGuestChromeDisplayName(
    branding.displayName,
    t("chrome.defaultSiteName")
  );
  return {
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },
    description: t("chrome.siteDescription", { siteName }),
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [localeRaw, messages] = await Promise.all([getLocale(), getMessages()]);
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  bindWorkspacePluginRegisterInvokers();
  await registerWorkspacePluginSafe(bootstrap.pluginId);
  ensureMemberWalletRendererRegistered(bootstrap.pluginId);
  await importGuestPortalThemeForPlugin(bootstrap.pluginId);
  const dir = resolveTextDirection(locale);
  const fontClassName = resolveAppFontClassName(locale);
  const fontFamilyBase = resolveAppFontFamilyCss(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${vazirmatn.variable} ${inter.variable} ${calistoga.variable} ${fontClassName}`}
      style={{ ["--font-family-base" as string]: fontFamilyBase }}
    >
      <body
        data-app="portal"
        data-app-surface="portal"
        data-workspace-plugin={bootstrap.pluginId}
        data-tenant-id={bootstrap.tenantId}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PortalProviders>{children}</PortalProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
