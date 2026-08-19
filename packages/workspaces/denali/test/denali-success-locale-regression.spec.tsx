import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import { DenaliDoneStep } from "../src/catalog/registration-flow/denali-registration-flow.done-step";

// Ensure denali workspace plugins are registered so `successDataAttributes()`
// can resolve the intake schema.
import {
  registerWorkspaceIntakeDENALIFromManifest,
} from "../../../guest-workspace-runtime/src/register-denali.generated";

const denaliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const portalMessagesRoot = join(denaliRoot, "../../../apps/portal/messages");

let didRegister = false;
let registerPromise: Promise<void> | null = null;

async function ensurePluginsRegistered(): Promise<void> {
  if (didRegister) return;
  if (registerPromise !== null) return registerPromise;
  registerPromise = registerWorkspaceIntakeDENALIFromManifest().then(() => {
    didRegister = true;
  });
  return registerPromise;
}

function loadCatalogMessages(locale: "en" | "fa") {
  const catalogRegistration = JSON.parse(
    readFileSync(join(portalMessagesRoot, locale, "catalogRegistration.json"), "utf8")
  ) as Record<string, unknown>;

  return { catalogRegistration };
}

async function renderDone(locale: "en" | "fa") {
  await ensurePluginsRegistered();
  const messages = loadCatalogMessages(locale);

  const context = {
    pluginId: "denali",
    tenantId: "tenant-1",
    tourId: "tour-1",
    tourTitle: "Tour",
    backHref: "/back",
    memberModuleHref: "/me/registrations",
  } as unknown as Parameters<typeof DenaliDoneStep>[0]["context"];

  const state = {
    currentStep: "done",
    data: {},
  } as unknown as Parameters<typeof DenaliDoneStep>[0]["state"];

  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages as any}>
      <DenaliDoneStep
        context={context}
        state={state}
        dispatch={() => {}}
        resolveError={() => ""}
      />
    </NextIntlClientProvider>
  );
}

describe("denali-success-locale-regression.spec.tsx", () => {
  it("EN success: entirely English (no Persian strings)", async () => {
    const html = await renderDone("en");
    assert.match(html, /dir="ltr"/);
    assert.match(html, /Request submitted/);
    assert.match(html, /Registration received for Tour/);
    assert.match(html, /View my registrations/);
    assert.match(html, /Back to tour/);

    // No Persian fallback
    assert.doesNotMatch(html, /درخواست ثبت شد/);
    assert.doesNotMatch(html, /مشاهده ثبت\u200cنام\u200cهای من/);
    assert.doesNotMatch(html, /ثبت\u200cنام/);
    assert.doesNotMatch(html, /بازگشت به تور/);
  });

  it("FA success: entirely Persian (no English strings)", async () => {
    const html = await renderDone("fa");
    assert.match(html, /dir="rtl"/);
    assert.match(html, /درخواست ثبت شد/);
    assert.match(html, /درخواست شما برای Tour ثبت شد/);
    assert.match(html, /مشاهده ثبت\u200cنام\u200cهای من/);
    assert.match(html, /بازگشت به تور/);

    assert.doesNotMatch(html, /Request submitted/);
    assert.doesNotMatch(html, /Registration received for Tour/);
    assert.doesNotMatch(html, /View my registrations/);
    assert.doesNotMatch(html, /Back to tour/);
  });
});

