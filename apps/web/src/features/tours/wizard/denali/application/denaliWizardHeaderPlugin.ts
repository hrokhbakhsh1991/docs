import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { DenaliRuleSet } from "@repo/denali-domain";
import type { TourFormProfile } from "@repo/types";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

export type DenaliWizardHeaderPluginFormMethods = Pick<
  UseFormReturn<DenaliCreateTourWizardForm>,
  "getValues" | "reset" | "control"
>;

/**
 * Context passed to Denali create-wizard header plugins (no direct RHF context access).
 */
export type DenaliWizardHeaderPluginContext = {
  readonly activeStepId: DenaliCreateWizardStepId;
  readonly formMethods: DenaliWizardHeaderPluginFormMethods;
  readonly ruleSet: DenaliRuleSet;
  readonly workspaceFormProfile: TourFormProfile | undefined;
  /** Bump {@link DenaliCanonicalProvider} `syncToken` after template/preset hydration. */
  readonly onCanonicalSync: () => void;
  /** Reset wizard to workspace template baseline (clear preset). */
  readonly onClearForm?: () => void;
  /** Reset to registry defaults and purge server draft (Start Over). */
  readonly onClearAll?: () => void | Promise<void>;
};

export type DenaliWizardHeaderPlugin = {
  readonly id: string;
  shouldRender: (context: DenaliWizardHeaderPluginContext) => boolean;
  render: (context: DenaliWizardHeaderPluginContext) => ReactNode;
};
