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

function renderMemberLogin(transport: GuestAuthTransport, onAuthenticated: () => void) {
  function Fixture() {
    const [state, dispatch] = useReducer(applyCatalogRegistrationFlowEvent, {
      currentStep: "phone",
      data: { ...createCatalogRegistrationFlowInitialData(), phone: "09120000000" },
    });
    return (
      <NextIntlClientProvider locale="fa" messages={{ catalogRegistration }}>
        <GuestAuthHostProvider transport={transport} onAuthenticated={onAuthenticated}>
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
  return render(<Fixture />);
}

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
  const view = renderMemberLogin(transport, () => {
    completed++;
  });
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

test("member login focuses the destination input only when switching sign-in methods", async () => {
  const view = renderMemberLogin(
    {
      isPasswordLoginAvailable: async () => true,
      preflightPhone: async () => ({ exists: true }),
      requestOtp: async () => ({ challengeId: "unused" }),
      verifyOtp: async () => ({ outcome: "session_ready" }),
      completeProfile: async () => ({ outcome: "session_ready" }),
      probeSession: async () => ({ ready: false }),
    },
    () => {}
  );
  const choose = await view.findByRole("button", { name: catalogRegistration.password.choose });
  const phone = view.getByLabelText(catalogRegistration.phone.label) as HTMLInputElement;
  const originalPhone = phone.value;
  assert.notEqual(document.activeElement, phone);
  choose.focus();
  fireEvent.click(choose);
  const passwordFocus = (document.activeElement as HTMLElement).id;
  const back = view.getByRole("button", { name: catalogRegistration.password.useOtp });
  back.focus();
  fireEvent.click(back);
  const returnedPhone = view.getByLabelText(catalogRegistration.phone.label) as HTMLInputElement;
  assert.equal(returnedPhone.value, originalPhone);
  assert.deepEqual(
    [passwordFocus, document.activeElement === returnedPhone],
    ["guest-password", true]
  );
});

test("member login accepts localized complete mobile entries without starting OTP on method switch", async () => {
  let requested = 0;
  let authenticatedPhone: string | undefined;
  const view = renderMemberLogin(
    {
      isPasswordLoginAvailable: async () => true,
      preflightPhone: async () => ({ exists: true }),
      requestOtp: async () => {
        requested++;
        return { challengeId: "unused" };
      },
      verifyOtp: async () => ({ outcome: "session_ready" }),
      loginWithPassword: async ({ phone }) => {
        authenticatedPhone = phone;
        return { outcome: "session_ready" };
      },
      completeProfile: async () => ({ outcome: "session_ready" }),
      probeSession: async () => ({ ready: false }),
    },
    () => {}
  );

  for (const localized of ["۰۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩", "+۹۸ ۹۱۲ ۳۴۵ ۶۷۸۹", "٠٠٩٨٩١٢٣٤٥٦٧٨٩"]) {
    const phoneInput = view.getByLabelText(catalogRegistration.phone.label) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: localized } });
    fireEvent.click(await view.findByRole("button", { name: catalogRegistration.password.choose }));
    assert.equal(document.activeElement?.id, "guest-password");
    fireEvent.click(view.getByRole("button", { name: catalogRegistration.password.useOtp }));
    assert.equal(
      (view.getByLabelText(catalogRegistration.phone.label) as HTMLInputElement).value,
      "09123456789"
    );
  }

  fireEvent.click(view.getByRole("button", { name: catalogRegistration.password.choose }));
  fireEvent.change(view.getByLabelText(catalogRegistration.password.label), {
    target: { value: "synthetic passphrase" },
  });
  fireEvent.click(view.getByRole("button", { name: catalogRegistration.password.signIn }));
  await waitFor(() => assert.equal(authenticatedPhone, "09123456789"));
  assert.equal(requested, 0);
});
