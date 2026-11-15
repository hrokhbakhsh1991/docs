import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { PasswordSettings } from "../../../packages/account-security-ui/src/password-settings";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(cleanup);

const labels = {
  title: "Password",
  create: "Create password",
  change: "Change password",
  requestOtp: "Send code",
  retry: "Retry",
  resend: "Resend",
  otp: "Code",
  otpHint: "We will send a code",
  password: "New password",
  confirm: "Confirm password",
  hint: "Use a long passphrase",
  save: "Save",
  loading: "Loading",
  saved: "Saved",
  mismatch: "Passwords do not match",
  show: "Show",
  hide: "Hide",
  cancel: "Cancel",
  error: (code: string) => code,
};

test("password setup rejects mismatched confirmation and submits the entered OTP only after a match", async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ url: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
    if (init?.method === "GET") return Response.json({ ok: true, has_password: false });
    if (url.endsWith("/request-otp"))
      return Response.json({ ok: true, challenge_id: "challenge", otp_length: 4 });
    return Response.json({ ok: true });
  };
  try {
    const view = render(<PasswordSettings basePath="/api/identity/me/password" labels={labels} />);
    const create = await view.findByRole("button", { name: "Create password" });
    fireEvent.click(create);
    const otp = await view.findByLabelText("Code");
    fireEvent.change(otp, { target: { value: "۰۱۵۷" } });
    fireEvent.change(view.getByLabelText("New password"), {
      target: { value: "synthetic long passphrase" },
    });
    fireEvent.change(view.getByLabelText("Confirm password"), {
      target: { value: "different phrase" },
    });
    fireEvent.click(view.getByRole("button", { name: "Save" }));
    assert.ok(await view.findByText("Passwords do not match"));
    assert.equal(
      requests.filter((entry) => entry.url === "/api/identity/me/password" && entry.body).length,
      0
    );
    fireEvent.change(view.getByLabelText("Confirm password"), {
      target: { value: "synthetic long passphrase" },
    });
    fireEvent.click(view.getByRole("button", { name: "Save" }));
    await waitFor(() => assert.ok(view.getByRole("status")));
    const submitted = requests.find(
      (entry) => entry.url === "/api/identity/me/password" && entry.body
    );
    assert.deepEqual(JSON.parse(submitted!.body!), {
      challenge_id: "challenge",
      otp: "0157",
      password: "synthetic long passphrase",
    });
    assert.equal(view.queryByLabelText("New password"), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
