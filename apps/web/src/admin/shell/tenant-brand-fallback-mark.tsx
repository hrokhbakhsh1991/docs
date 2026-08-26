"use client";

import { Building2 } from "lucide-react";

import { resolveWizardCustomBrandFallbackMark } from "@/workspace/wizard-create-registry";

type TenantBrandFallbackMarkProps = {
  readonly pluginId: string;
  readonly workspaceLabel: string;
  readonly className?: string;
};

/**
 * Level 3 brand fallback — neutral workspace icon (not letter initial).
 * Logo SoT remains TenantBrandMark + TenantBrandingProvider.
 */
export function TenantBrandFallbackMark({
  pluginId,
  workspaceLabel,
  className,
}: TenantBrandFallbackMarkProps) {
  const _declaredKind = resolveWizardCustomBrandFallbackMark(pluginId);
  void _declaredKind;

  return (
    <span
      className={`${className ?? ""} inline-flex items-center justify-center text-muted-foreground`}
      data-tenant-brand-fallback
      data-tenant-brand-icon-fallback
      data-workspace-label={workspaceLabel}
      aria-hidden
    >
      <Building2 className="size-[65%]" aria-hidden />
    </span>
  );
}
