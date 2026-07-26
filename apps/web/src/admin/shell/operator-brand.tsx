"use client";

import { useTranslations } from "next-intl";

import { isExtendedOperatorWorkspace } from "@/workspace/is-extended-operator-workspace";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

import { TenantBrandMark } from "./tenant-brand-mark";
import { OPERATOR_NAV_TEST_IDS } from "./operator-nav.types";

type OperatorBrandProps = {
  readonly workspaceLabel: string;
  readonly pluginId: string;
  readonly displayName?: string | null;
};

export function OperatorBrand({ workspaceLabel, pluginId, displayName }: OperatorBrandProps) {
  const t = useTranslations("app");
  const usesExtendedCreateChrome = isExtendedOperatorWorkspace(pluginId);
  const title = useTenantBrandTitle(displayName, workspaceLabel);
  const tagline = usesExtendedCreateChrome
    ? t("extendedCreateChromeTagline")
    : t("operatorWorkspace");

  return (
    <div
      data-testid={OPERATOR_NAV_TEST_IDS.brand}
      data-operator-sidebar-brand
      data-workspace-plugin={pluginId}
      className="flex min-w-0 items-center gap-3"
    >
      <div
        data-operator-sidebar-brand-mark
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent shadow-sm"
      >
        <TenantBrandMark
          pluginId={pluginId}
          workspaceLabel={title}
          className="h-7 w-7 text-sidebar-primary"
          imageClassName="h-full w-full object-contain"
        />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{tagline}</p>
      </div>
    </div>
  );
}
