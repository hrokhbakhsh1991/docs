import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import "@tour/ui/styles.css";
import "./globals.css";

import { routing } from "@/i18n/routing";
import { vazirmatn } from "@/fonts/vazirmatn";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_AUDIT_REQUEST_HEADER } from "@/lib/auth/validate-session-token";
import { WORKSPACE_ASSERT_SKIP_HEADER } from "@/lib/tenant/workspace-assert-skip";
import { assertWorkspaceRequest } from "@/lib/tenant/assert-workspace-request";
import { ServerTenantProvider } from "@/lib/tenant/tenant-provider";

import { buildThemeInitScript } from "@/lib/theme/theme-preference";

import { AppChromeProviders } from "./providers";

const DOCUMENT_LOCALE = routing.defaultLocale;

/**
 * Root document: Persian-only for now (`lang="fa"` `dir="rtl"`).
 * `next-intl` stays active for `t()` / messages; URLs are locale-less (see `src/i18n/routing.ts`).
 */
export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(DOCUMENT_LOCALE);
  const t = await getTranslations({ locale: DOCUMENT_LOCALE, namespace: "metadata.layout" });

  return {
    title: {
      default: t("title"),
      template: t("titleTemplate"),
    },
    description: t("description"),
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }],
      shortcut: "/favicon.ico",
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  setRequestLocale(DOCUMENT_LOCALE);
  const messages = await getMessages();

  const headerBag = await headers();
  const authAudit = headerBag.get(AUTH_AUDIT_REQUEST_HEADER) ?? undefined;
  const skipWorkspaceAssert = headerBag.get(WORKSPACE_ASSERT_SKIP_HEADER) === "1";

  const tenantWrapped = skipWorkspaceAssert ? (
    children
  ) : (
    await (async () => {
      const workspace = await assertWorkspaceRequest(headerBag);
      if (!workspace.ok) {
        redirect("/workspace-not-found");
      }
      return <ServerTenantProvider tenant={workspace.tenant}>{children}</ServerTenantProvider>;
    })()
  );

  return (
    <html
      lang="fa"
      dir="rtl"
      className={vazirmatn.variable}
      suppressHydrationWarning
      {...(authAudit ? { "data-auth-audit": authAudit } : {})}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider locale={DOCUMENT_LOCALE} messages={messages}>
          <AppChromeProviders>{tenantWrapped}</AppChromeProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
