"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { useTenantConfig } from "@/lib/tenant/tenant-config-provider";

import styles from "./AppLayout.module.css";

export type WorkspaceBrandProps = {
  onNavigate?: () => void;
};

export function WorkspaceBrand({ onNavigate }: WorkspaceBrandProps) {
  const tApp = useTranslations("app");
  const { config } = useTenantConfig();
  const brandName = config.theme.brandName?.trim() || tApp("brand");
  const logoUrl = config.theme.logoUrl?.trim();

  return (
    <Link href="/dashboard" className={styles.brand} onClick={onNavigate}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant-provided logo URL
        <img src={logoUrl} alt="" className={styles.brandLogo} width={28} height={28} />
      ) : null}
      <span className={styles.brandLabel}>{brandName}</span>
    </Link>
  );
}
