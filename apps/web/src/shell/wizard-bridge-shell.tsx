"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { TenantBrandMark } from "@/admin/shell/tenant-brand-mark";
import { TenantBrandingProvider, useTenantBrandTitle } from "@/tenant/tenant-branding-context";

import { WIZARD_BRIDGE_TEST_IDS } from "./wizard-bridge.types";
import { WizardBridgeThemeToggle } from "./wizard-bridge-theme-toggle";

type WizardBridgeShellProps = {
  readonly children: ReactNode;
  readonly workspaceLabel: string;
  readonly pluginId: string;
  readonly displayName?: string | null;
};

export function WizardBridgeShell({
  children,
  workspaceLabel,
  pluginId,
  displayName,
}: WizardBridgeShellProps) {
  return (
    <TenantBrandingProvider
      pluginId={pluginId}
      workspaceLabel={workspaceLabel}
      initialDisplayName={displayName}
    >
    <WizardBridgeShellChrome
      workspaceLabel={workspaceLabel}
      pluginId={pluginId}
      displayName={displayName}
    >
      {children}
    </WizardBridgeShellChrome>
    </TenantBrandingProvider>
  );
}

function WizardBridgeShellChrome({
  children,
  workspaceLabel,
  pluginId,
  displayName,
}: WizardBridgeShellProps) {
  const tApp = useTranslations("app");
  const tWizard = useTranslations("wizard.bridge");
  const isDenali = pluginId === "denali";
  const title = useTenantBrandTitle(displayName, workspaceLabel);

  return (
    <div className="wizard-bridge-shell" data-testid={WIZARD_BRIDGE_TEST_IDS.shell}>
      <header className="wizard-bridge-shell__header">
        <div className="wizard-bridge-shell__brand">
          <div className="wizard-bridge-shell__brand-mark" aria-hidden>
            <TenantBrandMark
              pluginId={pluginId}
              workspaceLabel={title}
              className="wizard-bridge-shell__brand-mark-icon"
              imageClassName="wizard-bridge-shell__brand-mark-img"
            />
          </div>
          <div className="wizard-bridge-shell__brand-text">
            <p className="wizard-bridge-shell__brand-title">{title}</p>
            <p className="wizard-bridge-shell__brand-tagline">
              {isDenali ? tApp("denaliTagline") : tApp("operatorWorkspace")}
            </p>
          </div>
        </div>
        <nav className="wizard-bridge-shell__nav" aria-label={tWizard("navAria")}>
          <Link
            href="/tours"
            className="wizard-bridge-shell__back"
            data-testid={WIZARD_BRIDGE_TEST_IDS.backTours}
          >
            <ArrowRight className="wizard-bridge-shell__back-icon" aria-hidden size={14} />
            {tWizard("backToTours")}
          </Link>
          <Link
            href="/dashboard"
            className="wizard-bridge-shell__back"
            data-testid={WIZARD_BRIDGE_TEST_IDS.backDashboard}
          >
            {tWizard("backToDashboard")}
          </Link>
          <WizardBridgeThemeToggle />
        </nav>
      </header>
      <main className="wizard-bridge-shell__main" aria-label={tWizard("mainAria")}>
        {children}
      </main>
    </div>
  );
}
