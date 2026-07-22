import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildAuthLoginPageMetadata } from "@/i18n/app-page-metadata";
import { isPlatformAdminHost } from "@/platform/is-platform-admin-host";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding.server";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthLoginPageMetadata();
}

export const dynamic = "force-dynamic";

type AuthLoginPageProps = {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthLoginPage({ searchParams }: AuthLoginPageProps) {
  const params = await searchParams;
  if (params.phone !== undefined) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "phone" || value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const entry of value) {
          next.append(key, entry);
        }
      } else {
        next.set(key, value);
      }
    }
    const query = next.toString();
    redirect(query.length > 0 ? `/auth/login?${query}` : "/auth/login");
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const searchQuery = serializeLoginSearchParams(params);

  if (isPlatformAdminHost(host)) {
    return (
      <LoginForm
        pluginId="platform"
        initialBranding={{
          displayName: "Platform Control Center",
          logoUrl: null,
          primaryColor: null,
          defaultLocale: null,
        }}
        searchQuery={searchQuery}
      />
    );
  }

  const [bootstrap, branding] = await Promise.all([
    resolveBootstrapAppSessionForHost(host),
    fetchPublicTenantBrandingForHost(host),
  ]);
  return (
    <LoginForm
      pluginId={bootstrap.session.pluginId}
      initialBranding={branding}
      searchQuery={searchQuery}
    />
  );
}

function serializeLoginSearchParams(
  params: Record<string, string | string[] | undefined>
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || key === "phone") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        next.append(key, entry);
      }
    } else {
      next.set(key, value);
    }
  }
  return next.toString();
}
