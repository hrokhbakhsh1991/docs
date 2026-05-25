"use client";

import { useTranslations } from "next-intl";

/**
 * Renders a notice when draft mode is active for the profile.
 */
export function DraftNotice() {
  const t = useTranslations("tours.new");
  return (
    <div style={{ padding: "0.75rem", background: "#fef3c7", borderRadius: "0.25rem", marginBottom: "1rem" }}>
      <strong style={{ display: "block", marginBottom: "0.25rem" }}>{t("draftModeActive")}</strong>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "#92400e" }}>{t("draftModeExplanation")}</p>
    </div>
  );
}
