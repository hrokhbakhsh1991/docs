"use client";

import { useTranslations } from "next-intl";

import { Button } from "@app-tour/ui-primitives/button";

import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";

type OperatorWorkspaceSwitcherProps = {
  readonly workspaceLabel: string;
};

export function OperatorWorkspaceSwitcher({ workspaceLabel }: OperatorWorkspaceSwitcherProps) {
  const t = useTranslations("app");

  return (
    <Button
      type="button"
      variant="secondary"
      disabled
      title={t("workspaceSwitcherTitle")}
      data-testid={OPERATOR_NAV_TEST_IDS.workspaceSwitcher}
    >
      {workspaceLabel}
    </Button>
  );
}
