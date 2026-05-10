"use client";

import { useTranslations } from "next-intl";

export default function AuthSegmentLoading() {
  const t = useTranslations("auth");

  return (
    <p role="status" aria-live="polite" style={{ padding: "var(--space-4)" }}>
      {t("common.loading")}
    </p>
  );
}
