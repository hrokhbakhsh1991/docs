"use client";

import type { ReactNode } from "react";
import { Suspense, createContext, useContext } from "react";
import { useTranslations } from "next-intl";
import type { TourFormProfile } from "@repo/types";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import type { LayoutManifest } from "@/features/tours/wizard/shell/layout";

const LayoutContext = createContext<LayoutManifest | null>(null);

function StepLoadingIndicator() {
  const t = useTranslations("tours.new");

  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="wizard-step-loading"
      style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}
    >
      {t("wizard.stepLoading")}
    </p>
  );
}

export function LayoutProvider({
  layout,
  children,
}: {
  layout: LayoutManifest;
  children: ReactNode;
}) {
  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>;
}

/** @deprecated Prefer LayoutProvider with a pre-built manifest from the orchestrator. */
export function TourWizardLayoutProvider({
  profile: _profile,
  template: _template,
  config,
  children,
}: {
  profile: TourFormProfile;
  template?: TenantWizardTemplate | null;
  config: LayoutManifest;
  children: ReactNode;
}) {
  return <LayoutProvider layout={config}>{children}</LayoutProvider>;
}

export function useWizardLayout(): LayoutManifest {
  const layout = useContext(LayoutContext);
  if (layout == null) {
    throw new Error("useWizardLayout must be used within LayoutProvider");
  }
  return layout;
}

/** @deprecated Use useWizardLayout */
export const useTourWizardLayout = useWizardLayout;

export function WizardStepBody({ stepId }: { stepId: string }) {
  const layout = useWizardLayout();
  const StepPanel = layout.stepComponentMap[stepId];

  if (StepPanel == null) {
    return null;
  }

  return (
    <Suspense fallback={<StepLoadingIndicator />}>
      <StepPanel />
    </Suspense>
  );
}
