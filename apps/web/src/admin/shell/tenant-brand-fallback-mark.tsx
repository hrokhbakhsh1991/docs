import { WORKSPACE_WIZARD_CUSTOM_BRAND_FALLBACK_MARKS } from "@/bootstrap/wizard-create-bindings.generated";

type TenantBrandFallbackMarkProps = {
  readonly pluginId: string;
  readonly workspaceLabel: string;
  readonly className?: string;
};

/**
 * Level 3 brand fallback — letter initial.
 * Manifest may declare `wizardCreate.customBrandFallbackMark` (codegen map), but SVG/component
 * rendering requires Wave H.e.b registry — string kinds alone must not hard-code product imports.
 * @see docs/dev/wave-h-brand-fallback-neutral.mdoc
 */
export function TenantBrandFallbackMark({
  pluginId,
  workspaceLabel,
  className,
}: TenantBrandFallbackMarkProps) {
  // Touch codegen map so regenerations stay wired; H.e.b will resolve components by kind.
  const _declaredKind = WORKSPACE_WIZARD_CUSTOM_BRAND_FALLBACK_MARKS[pluginId];
  void _declaredKind;

  return (
    <span className={className} data-tenant-brand-initial aria-hidden>
      {workspaceLabel.slice(0, 1).toUpperCase()}
    </span>
  );
}
