import type { Metadata } from "next";
import { headers } from "next/headers";

import { buildAuthLoginPageMetadata } from "@/i18n/app-page-metadata";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding.server";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthLoginPageMetadata();
}

export const dynamic = "force-dynamic";

export default async function AuthLoginPage() {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const [bootstrap, branding] = await Promise.all([
    Promise.resolve(resolveBootstrapAppSessionForHost(host)),
    fetchPublicTenantBrandingForHost(host),
  ]);
  return (
    <LoginForm
      pluginId={bootstrap.session.pluginId}
      initialBranding={branding}
    />
  );
}
