import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import React, { useReducer } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createCatalogRegistrationFlowInitialData } from "@app-tour/catalog-registration-auth";
import { applyCatalogRegistrationFlowEvent } from "@app-tour/workspace-sdk";
import { CatalogRegistrationPhoneStep } from "../../../packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps";
import { GuestAuthHostProvider } from "../../../packages/catalog-registration-flow-ui/src/guest-auth-host";
import type { GuestAuthTransport } from "../../../packages/catalog-registration-flow-ui/src/guest-auth-transport";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(cleanup);
const catalogRegistration = JSON.parse(
  readFileSync("../portal/messages/fa/catalogRegistration.json", "utf8")
);

test("member password login checks the session before completing and does not request an OTP", async () => {
  let loginCount = 0;
  let otpCount = 0;
  let completed = 0;
  let sessionReady = false;
  const transport: GuestAuthTransport = {
    isPasswordLoginAvailable: async () => true,
    preflightPhone: async () => ({ exists: true }),
    requestOtp: async () => {
      otpCount++;
      return { challengeId: "otp" };
    },
    verifyOtp: async () => ({ outcome: "session_ready" }),
    loginWithPassword: async () => {
      loginCount++;
      return { outcome: "session_ready" };
    },
    completeProfile: async () => ({ outcome: "session_ready" }),
    probeSession: async () => ({ ready: sessionReady }),
  };
  function Fixture() {
    const [state, dispatch] = useReducer(applyCatalogRegistrationFlowEvent, {
      currentStep: "phone",
      data: { ...createCatalogRegistrationFlowInitialData(), phone: "09120000000" },
    });
    return (
      <NextIntlClientProvider locale="fa" messages={{ catalogRegistration }}>
        <GuestAuthHostProvider
          transport={transport}
          onAuthenticated={() => {
            completed++;
          }}
        >
          <CatalogRegistrationPhoneStep
            context={{
              pluginId: "denali",
              tenantId: "tenant",
              tourId: "tour",
              tourTitle: "Tour",
              backHref: "/",
              memberModuleHref: null,
              memberLoginEgress: true,
            }}
            state={state}
            dispatch={dispatch}
            resolveError={(code) => code}
          />
        </GuestAuthHostProvider>
      </NextIntlClientProvider>
    );
  }
  const view = render(<Fixture />);
  const choose = await view.findByRole("button", { name: catalogRegistration.password.choose });
  fireEvent.click(choose);
  fireEvent.change(view.getByLabelText(catalogRegistration.password.label), {
    target: { value: "synthetic passphrase" },
  });
  fireEvent.click(view.getByRole("button", { name: catalogRegistration.password.signIn }));
  await waitFor(() => assert.equal(view.getByRole("alert").textContent, "network"));
  assert.equal(completed, 0);
  assert.equal(otpCount, 0);
  sessionReady = true;
  fireEvent.change(view.getByLabelText(catalogRegistration.password.label), {
    target: { value: "synthetic passphrase" },
  });
  fireEvent.click(view.getByRole("button", { name: catalogRegistration.password.signIn }));
  await waitFor(() => assert.equal(completed, 1));
  assert.equal(loginCount, 2);
});
