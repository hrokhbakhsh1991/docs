import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AppProviders } from "@/providers/app-providers";
import { AppShell } from "@/shell/app-shell";
import { fetchTenantThemeForContext } from "@/tenant/fetch-tenant-theme.server";
import {
  resolveBootstrapAppSession,
  toSerializableBootstrap,
} from "@/tenant/tenant-kernel";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tour Ops",
  description: "Platform web shell (Phase 4)",
};

/** Session is resolved per request — do not prerender with module-static dev identity. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const resolved = resolveBootstrapAppSession();
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const tenantTheme = await fetchTenantThemeForContext(resolved.context, host);
  const bootstrap = toSerializableBootstrap(
    resolved,
    tenantTheme ?? undefined,
  );

  return (
    <html lang="en">
      <body data-tenant-id={resolved.context.tenantId}>
        <AppProviders bootstrap={bootstrap}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
