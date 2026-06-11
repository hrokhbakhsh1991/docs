"use client";

import { useTranslations } from "next-intl";

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
  const isDenali = pluginId === "denali";
  const title = useTenantBrandTitle(displayName, workspaceLabel);

  return (
    <div data-testid={OPERATOR_NAV_TEST_IDS.brand} data-workspace-plugin={pluginId} className="space-y-1.5">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
        <TenantBrandMark
          pluginId={pluginId}
          workspaceLabel={title}
          className="h-8 w-8 text-primary"
          imageClassName="h-full w-full object-contain"
        />
      </div>
      <p className="text-base font-semibold leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground">
        {isDenali ? t("denaliTagline") : t("operatorWorkspace")}
      </p>
    </div>
  );
}
