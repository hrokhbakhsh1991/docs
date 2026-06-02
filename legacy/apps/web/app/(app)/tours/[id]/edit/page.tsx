import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { decodeJwtPayload } from "@/lib/auth/decode-jwt-payload";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import { routing } from "@/i18n/routing";
import { lookupWorkspaceTenantMetadata } from "@/lib/tenant/lookup-workspace-tenant";
import { resolveRuntimeTenantContextFromTrustedHeaders } from "@/lib/tenant/runtime-tenant-context";
import { fetchTourTitleForMetadata } from "@/lib/tours/fetchTourTitleForMetadata";

import { TourEditClient, type TourEditInitialSession } from "./tour-edit-client";

const LOCALE = routing.defaultLocale;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "tours.edit" });
  const tourTitle = await fetchTourTitleForMetadata(params.id);

  return {
    title: tourTitle ? t("metaTitle", { title: tourTitle }) : t("metaTitleDefault"),
    description: t("metaDesc"),
  };
}

export default async function EditTourPage({ params }: { params: { id: string } }) {
  const token = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  const claims = token ? decodeJwtPayload(token) : null;
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
  const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
  const initialSession: TourEditInitialSession | null =
    userId && tenantId ? { userId, tenantId, role } : null;

  if (initialSession?.tenantId) {
    try {
      const runtimeTenant = resolveRuntimeTenantContextFromTrustedHeaders(headers());
      if (runtimeTenant.tenantSlug) {
        const hostMeta = await lookupWorkspaceTenantMetadata(runtimeTenant.tenantSlug);
        const hostTenantId =
          hostMeta?.tenantId && hostMeta.tenantId !== "unknown" ? hostMeta.tenantId : undefined;
        if (hostTenantId && hostTenantId !== initialSession.tenantId) {
          notFound();
        }
      }
    } catch {
      // Host resolution failures fall through; client guards and BFF enforce tenant alignment.
    }
  }

  return <TourEditClient tourId={params.id} initialSession={initialSession} />;
}
