"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  applyOperatorThemeMode,
  readInitialOperatorThemeDark,
} from "./operator-theme-mode";
import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";

export function OperatorThemeToggleButton() {
  const t = useTranslations("app");
  const [dark, setDark] = useState(readInitialOperatorThemeDark);

  useEffect(() => {
    applyOperatorThemeMode(dark);
  }, [dark]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("toggleTheme")}
      data-testid={OPERATOR_NAV_TEST_IDS.themeToggle}
      onClick={() => setDark((value) => !value)}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
