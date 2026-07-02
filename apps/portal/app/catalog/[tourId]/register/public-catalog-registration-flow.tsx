"use client";

import "@app-tour/workspace-plugin-host/register";

import {
  getWorkspaceRegistrationFlowPlugin,
  type FlowEvent,
  type PublicCatalogTransportSnapshot,
  type RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import { getWorkspaceRegistrationFlowSteps } from "@app-tour/workspace-plugin-host/registration-flow";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useReducer } from "react";

import { resolveCatalogRegistrationErrorMessage } from "@/features/catalog/resolve-catalog-registration-error";

type PublicCatalogRegistrationFlowProps = {
  readonly workspace: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly tourPoliciesText?: string | null;
  readonly tourPriceAmount?: number | null;
  readonly tourTransport?: PublicCatalogTransportSnapshot;
  readonly tourNationalIdRequired?: boolean;
  readonly tourFatherNameRequired?: boolean;
  readonly tourBirthDateRequired?: boolean;
  readonly backHref: string;
};

export function PublicCatalogRegistrationFlow({
  workspace,
  tenantId,
  tourId,
  tourTitle,
  tourPoliciesText,
  tourPriceAmount = null,
  tourTransport,
  tourNationalIdRequired = false,
  tourFatherNameRequired = false,
  tourBirthDateRequired = false,
  backHref,
}: PublicCatalogRegistrationFlowProps) {
  const t = useTranslations("catalogRegistration");
  const flowPlugin = getWorkspaceRegistrationFlowPlugin(workspace);
  const steps = getWorkspaceRegistrationFlowSteps(workspace);

  const context = useMemo(
    (): RegistrationFlowContext => ({
      pluginId: workspace,
      tenantId,
      tourId,
      tourTitle,
      tourPoliciesText,
      tourPriceAmount,
      tourTransport,
      tourRequirements: {
        nationalIdRequired: tourNationalIdRequired,
        fatherNameRequired: tourFatherNameRequired,
        birthDateRequired: tourBirthDateRequired,
      },
      backHref,
    }),
    [
      backHref,
      tenantId,
      tourBirthDateRequired,
      tourFatherNameRequired,
      tourId,
      tourNationalIdRequired,
      tourPoliciesText,
      tourPriceAmount,
      tourTitle,
      tourTransport,
      workspace,
    ]
  );

  const [state, dispatch] = useReducer(
    (current, event: FlowEvent) =>
      flowPlugin !== null
        ? flowPlugin.catalogRegistrationFlow.resolveNextStep(current, event, context)
        : current,
    flowPlugin !== null ? flowPlugin.catalogRegistrationFlow.createInitialState(context) : {
        currentStep: "",
        data: {},
      }
  );

  const resolveError = useCallback(
    (code: string) => resolveCatalogRegistrationErrorMessage(t, code),
    [t]
  );

  if (flowPlugin === null || steps === null) {
    return <p role="alert">{resolveError("REGISTRATION_CLOSED")}</p>;
  }

  const Step = steps[state.currentStep];
  if (Step === undefined) {
    return <p role="alert">{resolveError("network")}</p>;
  }

  return (
    <Step context={context} state={state} dispatch={dispatch} resolveError={resolveError} />
  );
}
