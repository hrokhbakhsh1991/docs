"use client";

import { useTranslations } from "next-intl";

import { Button } from "@tour/ui";

export default function AuthSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("auth.errorBoundary");

  return (
    <div role="alert" style={{ padding: "var(--space-4)", maxWidth: "28rem", margin: "0 auto" }}>
      <p style={{ marginTop: 0, fontWeight: "var(--text-h3-weight)" }}>{t("title")}</p>
      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-small-size)" }}>
        {error.message || t("descriptionFallback")}
      </p>
      <Button type="button" variant="secondary" onClick={() => reset()}>
        {t("tryAgain")}
      </Button>
    </div>
  );
}
