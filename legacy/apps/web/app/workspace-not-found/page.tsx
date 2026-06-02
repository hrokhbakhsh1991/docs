import { getTranslations, setRequestLocale } from "next-intl/server";
import { headers } from "next/headers";

import { routing } from "@/i18n/routing";
import { isBareApexHost } from "@/lib/tenant/runtime-tenant-context";

const LOCALE = routing.defaultLocale;

export async function generateMetadata() {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "auth.workspaceNotFound" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function WorkspaceNotFoundPage() {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "auth.workspaceNotFound" });
  const host = (await headers()).get("host")?.trim() ?? "";
  const apex = isBareApexHost(host);

  return (
    <main style={{ margin: "3rem auto", maxWidth: "28rem", padding: "0 1.25rem" }}>
      <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        {t("title")}
      </h1>
      <p style={{ lineHeight: 1.6, marginBottom: "0.5rem" }}>
        {apex ? t("apexDescription") : t("description")}
      </p>
      {apex ? (
        <p style={{ lineHeight: 1.6, marginBottom: "0.5rem", fontSize: "0.9rem" }}>
          {t("apexHint")}
        </p>
      ) : null}
      {host ? (
        <p style={{ fontSize: "0.875rem", opacity: 0.75, wordBreak: "break-all" }}>
          {t("hostLabel", { host })}
        </p>
      ) : null}
    </main>
  );
}
