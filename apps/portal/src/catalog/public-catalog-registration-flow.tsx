"use client";

import "@app-cloud/workspace-plugin-host/register";

import {
  getWorkspaceRegistrationFlowPlugin,
  type FlowEvent,
  type FlowRuntimeState,
  type PublicCatalogTransportSnapshot,
  type RegistrationFlowContext,
} from "@app-cloud/workspace-sdk";
import { getWorkspaceRegistrationFlowSteps } from "@app-cloud/workspace-plugin-host/registration-flow";
import { hydrateCatalogRegistrationIntakeAfterSession } from "@app-cloud/catalog-registration-flow-ui";
import {
  assertCatalogRegistrationFlowState,
  createCatalogRegistrationFlowRuntimeState,
} from "@app-cloud/catalog-registration-auth";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { resolveCatalogRegistrationErrorMessage } from "@/features/catalog/resolve-catalog-registration-error";
import { CatalogRegistrationStepper } from "@/catalog/catalog-registration-stepper";

export type PublicCatalogRegistrationFlowProps = {
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
  /** SSR-stable login egress — login host / modal (never derive from `window` during render). */
  readonly memberLoginEgress?: boolean;
  /** Register-host modal: probe cookie then callback instead of assign(portalReturn). */
  readonly memberLoginStayOnPage?: boolean;
  readonly onMemberLoginSessionReady?: () => void | Promise<void>;
};

type SessionResumeStatus = "checking" | "ready";

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
  memberLoginEgress = false,
  memberLoginStayOnPage = false,
  onMemberLoginSessionReady,
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
      memberLoginEgress,
      memberLoginStayOnPage,
      onMemberLoginSessionReady,
    }),
    [
      backHref,
      memberLoginEgress,
      memberLoginStayOnPage,
      memberModuleHref,
      onMemberLoginSessionReady,
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
    (current: FlowRuntimeState, event: FlowEvent) => {
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
  const [sessionResumeStatus, setSessionResumeStatus] = useState<SessionResumeStatus>(() => {
    if (memberLoginEgress || initialRuntimeState?.currentStep === "intake") {
      return "ready";
    }
    return "checking";
  });

  useEffect(() => {
    if (initialRuntimeState !== undefined || flowPlugin === null || memberLoginEgress) {
      setSessionResumeStatus("ready");
      return;
    }
    if (state.currentStep !== "phone") {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/profile", {
          credentials: "include",
          cache: "no-store",
        });
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
      } finally {
        if (!cancelled) {
          setSessionResumeStatus("ready");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context, flowPlugin, initialRuntimeState, memberLoginEgress, state.currentStep, tenantId]);

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

  const isResumeAtIntake =
    initialRuntimeState?.currentStep === "intake" || resumeAtIntake;
  const stepperMode = memberLoginEgress
    ? "login"
    : isResumeAtIntake
      ? "intake-only"
      : "registration";

  if (
    sessionResumeStatus === "checking" &&
    state.currentStep === "phone" &&
    !memberLoginEgress
  ) {
    return (
      <div data-public-registration-flow data-registration-resume-pending aria-busy="true">
        <p role="status">{t("sessionResume.pending")}</p>
      </div>
    );
  }

  const Step = steps[state.currentStep];
  if (Step === undefined) {
    return <p role="alert">{resolveError("network")}</p>;
  }

  return (
    <div
      data-public-registration-flow
      {...(memberLoginEgress ? { "data-member-login-egress": "" } : {})}
      {...(resumeAtIntake || initialRuntimeState?.currentStep === "intake"
        ? { "data-registration-resume": "intake" }
        : {})}
    >
      <CatalogRegistrationStepper currentStep={state.currentStep} mode={stepperMode} />
      <Step context={context} state={state} dispatch={dispatch} resolveError={resolveError} />
    </div>
  );
}
