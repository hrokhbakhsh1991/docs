import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { AuthLayout, Card, CardBody } from "@tour/ui";

import styles from "./auth-shell.module.css";

const LOCALE = routing.defaultLocale;

/**
 * Auth chrome: shell brand from `auth.common.shellBrand` (incremental i18n).
 */
export default async function AuthSegmentLayout({ children }: { children: ReactNode }) {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "auth" });

  return (
    <AuthLayout>
      <div className={styles.panel}>
        <Link href="/" className={styles.logo}>
          {t("common.shellBrand")}
        </Link>
        <Card className={styles.cardBox}>
          <CardBody>{children}</CardBody>
        </Card>
      </div>
    </AuthLayout>
  );
}
