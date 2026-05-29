"use client";

import { useTranslations } from "next-intl";
import { Button } from "@tour/ui";

import type { DenaliWizardHeaderPlugin } from "../application/denaliWizardHeaderPlugin";

function DenaliWizardClearAllPluginView(
  props: Parameters<NonNullable<DenaliWizardHeaderPlugin["render"]>>[0],
) {
  const t = useTranslations("tours.new");

  if (!props.onClearAll) {
    return null;
  }

  return (
    <div
      style={{ display: "flex", justifyContent: "flex-end" }}
      data-testid="denali-wizard-clear-all-wrap"
    >
      <Button
        type="button"
        variant="secondary"
        data-testid="denali-wizard-clear-all"
        onClick={() => {
          void props.onClearAll?.();
        }}
      >
        {t("wizardClearAll")}
      </Button>
    </div>
  );
}

/** Global create-wizard action: reset form + purge server draft. */
export const denaliWizardClearAllPlugin: DenaliWizardHeaderPlugin = {
  id: "denali-wizard-clear-all",
  shouldRender: (context) => context.onClearAll != null,
  render: (context) => <DenaliWizardClearAllPluginView {...context} />,
};
