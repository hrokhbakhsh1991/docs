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
  const initial = Array.from(workspaceLabel.trim())[0] ?? "W";

  return (
    <span
      className={`${className ?? ""} inline-flex items-center justify-center`}
      data-tenant-brand-fallback
      data-tenant-brand-initial
      data-workspace-label={workspaceLabel}
      aria-hidden
    >
      {initial}
    </span>
  );
}
