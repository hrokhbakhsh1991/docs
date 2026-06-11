"use client";

import { useTranslations } from "next-intl";
import React from "react";

/**
 * CASL deny surface — must not render wizard fields or plugin chrome (Phase 3.3 deny-by-default).
 */
export function WizardAccessDenied() {
  const t = useTranslations("wizard.accessDenied");
  return (
    <div
      role="alert"
      data-workspace-wizard-forbidden
      data-status-code="403"
      aria-live="assertive"
    >
      <h2>{t("title")}</h2>
      <p>{t("description")}</p>
    </div>
  );
}
