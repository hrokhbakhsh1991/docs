"use client";

import {
  getWorkspaceRegistrationFlowPlugin,
  type FlowEvent,
  type FlowRuntimeState,
  type PublicCatalogTransportSnapshot,
  type RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import { getWorkspaceRegistrationFlowSteps } from "@app-tour/workspace-plugin-host/registration-flow";
import {
  GuestAuthHostProvider,
  completeMemberLoginEgress,
  createPortalSameOriginGuestAuthTransport,
  hydrateCatalogRegistrationIntakeAfterSession,
  isMemberLoginEgressFromLocation,
} from "@app-tour/catalog-registration-flow-ui";
import {
  assertCatalogRegistrationFlowState,
  createCatalogRegistrationFlowRuntimeState,
} from "@app-tour/catalog-registration-auth";
import { ensureWorkspaceRegistrationFlowClient } from "@app-tour/guest-workspace-runtime/ensure-registration-flow-client";
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
  /**
   * Host continuation after auth steps `probeSession`. Login: assign portalReturn.
   * Register modal: close + reload. Must not live inside OTP/profile steps.
   */
  readonly onAuthenticated?: () => void | Promise<void>;
  /** Active self registration id on this tour — disables self tab when set. */
  readonly existingSelfRegistrationId?: string | null;
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
  onAuthenticated,
  existingSelfRegistrationId = null,
}: PublicCatalogRegistrationFlowProps) {
  const t = useTranslations("catalogRegistration");
  ensureWorkspaceRegistrationFlowClient(workspace);
  const flowPlugin = getWorkspaceRegistrationFlowPlugin(workspace);
  const steps = getWorkspaceRegistrationFlowSteps(workspace);
  const transport = useMemo(() => createPortalSameOriginGuestAuthTransport(), []);

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
      existingSelfRegistrationId,
    }),
    [
      backHref,
      existingSelfRegistrationId,
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

  const handleAuthenticated = useCallback(async () => {
    if (onAuthenticated !== undefined) {
      await onAuthenticated();
      return;
    }
    if (onMemberLoginSessionReady !== undefined) {
      await onMemberLoginSessionReady();
      return;
    }
    if (memberLoginEgress) {
      completeMemberLoginEgress({ memberLoginEgress: true });
      return;
    }
    await hydrateCatalogRegistrationIntakeAfterSession(
      context,
      state,
      dispatch,
      state.data.displayName.trim(),
      state.data.profileEmail.trim()
    );
  }, [
    context,
    dispatch,
    memberLoginEgress,
    onAuthenticated,
    onMemberLoginSessionReady,
    state,
  ]);

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
    if (isMemberLoginEgressFromLocation()) {
      setSessionResumeStatus("ready");
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
  // Login modal: no stepper chrome (PCMS-03-UX) — modal header title is enough.
  const showStepper = !memberLoginEgress;
  const stepperMode = isResumeAtIntake ? "intake-only" : "registration";

  if (
    sessionResumeStatus === "checking" &&
    state.currentStep === "phone" &&
    !memberLoginEgress
  ) {
    return (
      <div data-public-registration-flow data-registration-resume-pending aria-busy="true">
        <div data-registration-resume-pending-card>
          <p data-registration-resume-pending-eyebrow>{t("phone.loginTitle")}</p>
          <p role="status">{t("sessionResume.pending")}</p>
        </div>
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
      data-registration-stage={state.currentStep}
      {...(memberLoginEgress ? { "data-member-login-egress": "" } : {})}
      {...(resumeAtIntake || initialRuntimeState?.currentStep === "intake"
        ? { "data-registration-resume": "intake" }
        : {})}
    >
      {showStepper ? (
        <CatalogRegistrationStepper currentStep={state.currentStep} mode={stepperMode} />
      ) : null}
      <div data-public-registration-stage data-public-registration-stage-panel>
        <GuestAuthHostProvider transport={transport} onAuthenticated={handleAuthenticated}>
          <Step context={context} state={state} dispatch={dispatch} resolveError={resolveError} />
        </GuestAuthHostProvider>
      </div>
    </div>
  );
}
