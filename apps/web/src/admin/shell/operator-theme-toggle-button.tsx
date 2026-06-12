"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";
import { useOperatorThemeToggleState } from "./use-operator-theme-toggle-state";

export function OperatorThemeToggleButton() {
  const t = useTranslations("app");
  const { dark, mounted, toggle } = useOperatorThemeToggleState();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme")}
      data-testid={OPERATOR_NAV_TEST_IDS.themeToggle}
      onClick={toggle}
    >
      {mounted ? (
        dark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
