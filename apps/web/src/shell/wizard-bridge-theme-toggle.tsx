"use client";

import { Button } from "@app-tour/ui-primitives/button";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { useOperatorThemeToggleState } from "@/admin/shell/use-operator-theme-toggle-state";
import { OPERATOR_NAV_TEST_IDS } from "@/admin/shell/operator-nav.types";

export function WizardBridgeThemeToggle() {
  const t = useTranslations("app");
  const { dark, mounted, toggle } = useOperatorThemeToggleState();

  return (
    <Button
      type="button"
      variant="ghost"
      className="wizard-bridge-shell__theme-toggle"
      aria-label={t("toggleTheme")}
      data-testid={OPERATOR_NAV_TEST_IDS.themeToggle}
      onClick={toggle}
    >
      {mounted ? (
        dark ? (
          <Sun size={16} aria-hidden />
        ) : (
          <Moon size={16} aria-hidden />
        )
      ) : (
        <Moon size={16} aria-hidden />
      )}
    </Button>
  );
}
