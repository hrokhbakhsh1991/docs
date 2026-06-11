import { DenaliLogoMark } from "./denali-logo-mark";

type TenantBrandFallbackMarkProps = {
  readonly pluginId: string;
  readonly workspaceLabel: string;
  readonly className?: string;
};

/** Plugin mark when tenant has no uploaded logo (Level 3 fallback). */
export function TenantBrandFallbackMark({
  pluginId,
  workspaceLabel,
  className,
}: TenantBrandFallbackMarkProps) {
  if (pluginId === "denali") {
    return <DenaliLogoMark className={className} />;
  }

  return (
    <span className={className} data-tenant-brand-initial aria-hidden>
      {workspaceLabel.slice(0, 1).toUpperCase()}
    </span>
  );
}
