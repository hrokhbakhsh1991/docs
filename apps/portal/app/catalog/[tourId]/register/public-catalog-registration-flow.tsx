"use client";

import "@app-tour/workspace-plugin-host/register";

import {
  getWorkspaceRegistrationFlowPlugin,
  type FlowEvent,
  type FlowRuntimeState,
  type PublicCatalogTransportSnapshot,
  type RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import { getWorkspaceRegistrationFlowSteps } from "@app-tour/workspace-plugin-host/registration-flow";
import { hydrateCatalogRegistrationIntakeAfterSession } from "@app-tour/catalog-registration-flow-ui";
import {
  assertCatalogRegistrationFlowState,
  createCatalogRegistrationFlowRuntimeState,
} from "@app-tour/catalog-registration-auth";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

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
  readonly memberModuleHref: string | null;
  readonly initialRuntimeState?: FlowRuntimeState;
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
  memberModuleHref,
  initialRuntimeState,
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
      memberModuleHref,
    }),
    [
      backHref,
      memberModuleHref,
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
    (current, event: FlowEvent) => {
      const next =
        flowPlugin !== null
          ? flowPlugin.catalogRegistrationFlow.resolveNextStep(current, event, context)
          : current;
      if (process.env.NODE_ENV !== "production" && flowPlugin !== null) {
        assertCatalogRegistrationFlowState(next.data);
      }
      return next;
    },
    initialRuntimeState ??
      (flowPlugin !== null
        ? flowPlugin.catalogRegistrationFlow.createInitialState(context)
        : createCatalogRegistrationFlowRuntimeState({ initialStep: "" }))
  );

  const [resumedWithoutServer, setResumedWithoutServer] = useState(false);

  useEffect(() => {
    if (initialRuntimeState !== undefined || flowPlugin === null) {
      return;
    }
    if (state.currentStep !== "phone") {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/profile");
        if (!res.ok || cancelled) {
          return;
        }
        const body = (await res.json()) as { ok?: boolean; profile?: { tenantId?: string } };
        if (body.ok !== true || body.profile?.tenantId !== tenantId) {
          return;
        }
        setResumedWithoutServer(true);
        await hydrateCatalogRegistrationIntakeAfterSession(context, state, dispatch);
      } catch {
        // guest flow — stay on phone
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context, flowPlugin, initialRuntimeState, state.currentStep, tenantId]);

  const resumeAtIntake =
    state.currentStep === "intake" &&
    initialRuntimeState === undefined &&
    resumedWithoutServer;

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
    <div
      data-public-registration-flow
      {...(resumeAtIntake ? { "data-registration-resume": "intake" } : {})}
    >
      <Step context={context} state={state} dispatch={dispatch} resolveError={resolveError} />
    </div>
  );
}
