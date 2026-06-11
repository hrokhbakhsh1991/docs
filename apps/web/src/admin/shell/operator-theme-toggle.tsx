"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@app-tour/ui-primitives/button";

import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";

type ThemeMode = "light" | "dark";

function applyPlatformTheme(mode: ThemeMode): void {
  const tenantRoot = document.querySelector("[data-tenant-theme]");
  const platformRoot = tenantRoot?.parentElement;
  if (!(platformRoot instanceof HTMLElement)) {
    return;
  }
  platformRoot.classList.remove("theme-light", "theme-dark");
  platformRoot.classList.add(mode === "dark" ? "theme-dark" : "theme-light");
}

export function OperatorThemeToggle() {
  const t = useTranslations("app");
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    applyPlatformTheme(mode);
  }, [mode]);

  return (
    <div
      role="group"
      aria-label={t("themeMode")}
      data-testid={OPERATOR_NAV_TEST_IDS.themeToggle}
      style={{ display: "inline-flex", gap: "0.25rem" }}
    >
      <Button
        type="button"
        variant={mode === "light" ? "primary" : "secondary"}
        onClick={() => setMode("light")}
      >
        {t("themeLight")}
      </Button>
      <Button
        type="button"
        variant={mode === "dark" ? "primary" : "secondary"}
        onClick={() => setMode("dark")}
      >
        {t("themeDark")}
      </Button>
    </div>
  );
}
