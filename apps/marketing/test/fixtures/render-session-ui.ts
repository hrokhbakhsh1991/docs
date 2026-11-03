import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React, { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { MarketingSessionContext } from "../../src/auth/marketing-session-context";

// Node markup tests do not load CSS. The browser regression exercises real styles.
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {};
};
Object.assign(globalThis, { React });

const catalog = JSON.parse(
  readFileSync(new URL("../../messages/fa/catalog.json", import.meta.url), "utf8")
);
export const PROFILE_HREF = "https://portal.example.test/me/profile";

export function renderSessionUi(children: ReactNode, authenticated: boolean | null = null): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "fa",
      timeZone: "Asia/Tehran",
      messages: { catalog },
      children: createElement(MarketingSessionContext.Provider, {
        value: authenticated === null ? null : { authenticated, profileHref: PROFILE_HREF },
        children,
      }),
    })
  );
}
