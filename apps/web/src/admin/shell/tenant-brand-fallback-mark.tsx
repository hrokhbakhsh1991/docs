import { resolveWizardCustomBrandFallbackMark } from "@/workspace/wizard-create-registry";

type TenantBrandFallbackMarkProps = {
  readonly pluginId: string;
  readonly workspaceLabel: string;
  readonly className?: string;
};

/**
 * Level 3 brand fallback — letter initial.
 * Manifest/capability may declare `customBrandFallbackMark`, but SVG/component
 * rendering requires Wave H.e.b registry — string kinds alone must not hard-code product imports.
 * @see docs/dev/wave-h-brand-fallback-neutral.mdoc
 */
export function TenantBrandFallbackMark({
  pluginId,
  workspaceLabel,
  className,
}: TenantBrandFallbackMarkProps) {
  // Touch capability resolve so warm/seed stays wired; H.e.b will resolve components by kind.
  const _declaredKind = resolveWizardCustomBrandFallbackMark(pluginId);
  void _declaredKind;

  return (
    <span className={className} data-tenant-brand-initial aria-hidden>
      {workspaceLabel.slice(0, 1).toUpperCase()}
    </span>
  );
}
