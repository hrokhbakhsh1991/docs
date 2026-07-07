import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { buildRootLayoutMetadata } from "@/i18n/app-page-metadata";
import { inter, resolveAppFontClassName, resolveAppFontFamilyCss, vazirmatn } from "@/i18n/app-fonts";
import { intlFormatsForLocale } from "@/i18n/intl-formats";
import { isAppLocale, resolveTextDirection, routing } from "@/i18n/routing";
import { AppProviders } from "@/providers/app-providers";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { validateSessionToken } from "@app-tour/session-client";
import {
  resolveBootstrapAppSession,
  resolveBootstrapAppSessionForHostAsync,
  toSerializableBootstrap,
} from "@/tenant/tenant-kernel";

import { importAdminThemeForPlugin } from "@/bootstrap/workspace-theme-stylesheets.generated";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return buildRootLayoutMetadata();
}

/** Session is resolved per request — do not prerender with module-static dev identity. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [headerList, localeRaw, messages] = await Promise.all([headers(), getLocale(), getMessages()]);
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const host = headerList.get("host") ?? "localhost:3000";
  let resolved = await resolveBootstrapAppSessionForHostAsync(host);

  const cookieStore = await cookies();
  const sessionValidation = validateSessionToken(cookieStore.get(SESSION_TOKEN_COOKIE)?.value);
  if (sessionValidation.status === "valid") {
    resolved = resolveBootstrapAppSession(
      {
        userId: sessionValidation.userId,
        tenantId: sessionValidation.tenantId,
        workspaceId:
          sessionValidation.workspaceId ??
          resolved.context.workspaceId ??
          "default",
        role: (sessionValidation.role ?? resolved.context.role) as typeof resolved.context.role,
        status: "ACTIVE",
      },
      host,
      { pluginId: resolved.session.pluginId }
    );
  }

  await importAdminThemeForPlugin(resolved.session.pluginId);
  const tenantTheme = await fetchTenantThemeForContext(resolved.context, host);
  const bootstrap = toSerializableBootstrap(resolved, tenantTheme ?? undefined);
  const dir = resolveTextDirection(locale);

  const fontClassName = resolveAppFontClassName(locale);
  const fontFamilyBase = resolveAppFontFamilyCss(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${vazirmatn.variable} ${inter.variable} ${fontClassName}`}
      style={{ ["--font-family-base" as string]: fontFamilyBase }}
    >
      <body
        data-app-surface="admin"
        data-tenant-id={resolved.context.tenantId}
        data-workspace-plugin={bootstrap.pluginId}
        data-locale={locale}
        data-dir={dir}
      >
        <NextIntlClientProvider locale={locale} messages={messages} formats={intlFormatsForLocale(locale)}>
          <AppProviders bootstrap={bootstrap}>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
