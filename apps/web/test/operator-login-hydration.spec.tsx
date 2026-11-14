import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { LoginForm } from "../app/auth/login/login-form";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(cleanup);
const auth = JSON.parse(readFileSync(new URL("../messages/fa/auth.json", import.meta.url), "utf8"));
const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
};
function view() {
  return (
    <AppRouterContext.Provider value={router}>
      <NextIntlClientProvider locale="fa" messages={{ auth }}>
        <LoginForm pluginId="denali" passwordEnabled />
      </NextIntlClientProvider>
    </AppRouterContext.Provider>
  );
}

test("operator phone controls are disabled in server markup and enabled after hydration", () => {
  const html = renderToString(view());
  assert.match(html, /<input[^>]*id="phone"[^>]*disabled/);
  assert.doesNotMatch(html, /data-testid="operator-login-hydrated"/);
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const screen = render(view(), { container, hydrate: true });
  assert.equal((screen.getByLabelText("شماره موبایل") as HTMLInputElement).disabled, false);
  assert.ok(screen.getByTestId("operator-login-hydrated"));
  assert.equal(
    (screen.getByRole("button", { name: "ارسال رمز" }) as HTMLButtonElement).disabled,
    false
  );
});
