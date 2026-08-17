"use client";

import {
  catalogRegistrationAuthFlowSteps,
  GuestAuthHostProvider,
  type GuestAuthTransport,
} from "@app-tour/catalog-registration-flow-ui";
import { createCatalogRegistrationFlowRuntimeState } from "@app-tour/catalog-registration-auth";
import {
  applyCatalogRegistrationFlowEvent,
  type FlowEvent,
  type FlowRuntimeState,
  type RegistrationFlowContext,
} from "@app-tour/workspace-sdk";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useReducer } from "react";

import { resolveMarketingLoginError } from "./resolve-marketing-login-error";

export type MarketingLoginAuthFlowInput = {
  readonly pluginId: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly backHref: string;
  readonly memberModuleHref: string | null;
};

type Props = {
  readonly flow: MarketingLoginAuthFlowInput;
  readonly transport: GuestAuthTransport;
  readonly onAuthenticated: () => void | Promise<void>;
};

export function MarketingLoginAuthFlow({ flow, transport, onAuthenticated }: Props) {
  const t = useTranslations("catalogRegistration");
  const context = useMemo(
    (): RegistrationFlowContext => ({
      pluginId: flow.pluginId,
      tenantId: flow.tenantId,
      tourId: flow.tourId,
      tourTitle: flow.tourTitle,
      backHref: flow.backHref,
      memberModuleHref: flow.memberModuleHref,
      memberLoginEgress: true,
    }),
    [flow]
  );

  const [state, dispatch] = useReducer(
    (current: FlowRuntimeState, event: FlowEvent) => applyCatalogRegistrationFlowEvent(current, event),
    createCatalogRegistrationFlowRuntimeState({ initialStep: "phone" })
  );

  const resolveError = useCallback((code: string) => resolveMarketingLoginError(t, code), [t]);

  const Step = catalogRegistrationAuthFlowSteps[state.currentStep as keyof typeof catalogRegistrationAuthFlowSteps];
  if (Step === undefined) {
    return <p role="alert">{resolveError("network")}</p>;
  }

  return (
    <div data-public-registration-flow data-member-login-egress="" data-registration-stage={state.currentStep}>
      <div data-public-registration-stage data-public-registration-stage-panel>
        <GuestAuthHostProvider transport={transport} onAuthenticated={onAuthenticated}>
          <Step context={context} state={state} dispatch={dispatch} resolveError={resolveError} />
        </GuestAuthHostProvider>
      </div>
    </div>
  );
}
