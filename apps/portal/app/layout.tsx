import type { Metadata } from "next";
import { registerWorkspacePluginSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { isAppLocale, resolveTextDirection, routing } from "@/i18n/routing";
import { inter, resolveAppFontClassName, resolveAppFontFamilyCss, vazirmatn, calistoga } from "@/i18n/app-fonts";
import { PortalProviders } from "@/shell/portal-providers";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { importGuestPortalThemeForPlugin } from "@app-tour/guest-workspace-runtime/themes/portal";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Portal",
    template: "%s · Portal",
  },
  description: "Tour member portal",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [localeRaw, messages] = await Promise.all([getLocale(), getMessages()]);
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  bindWorkspacePluginRegisterInvokers();
  await registerWorkspacePluginSafe(bootstrap.pluginId);
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
