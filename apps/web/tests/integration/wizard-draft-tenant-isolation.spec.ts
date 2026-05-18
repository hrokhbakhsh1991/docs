import { expect, test } from "@playwright/test";

import { loginWithPhoneOtp } from "./real-tenant.helpers";
import { wizardDraftStorageKey } from "../../src/features/tours/wizard/tourWizardDraftEnvelope";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;
const port = process.env.PW_WEB_PORT?.trim() || "3002";

test.describe("real-stack draft tenant isolation (§6.1.2)", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1");

  test("denali draft key is absent on urban-demo origin", async ({ browser }) => {
    const marker = `isolation-${Date.now()}`;
    const denaliBase = process.env.PW_DENALI_BASE_URL?.trim() || `http://denali.localhost:${port}`;
    const urbanBase = process.env.PW_URBAN_BASE_URL?.trim() || `http://urban-demo.localhost:${port}`;
    const denaliKey = wizardDraftStorageKey("denali");

    const denaliCtx = await browser.newContext({ baseURL: denaliBase });
    const denaliPage = await denaliCtx.newPage();
    await loginWithPhoneOtp(denaliPage, "+989121000001");
    await denaliPage.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await denaliPage.evaluate(
      ({ key, title }) => {
        localStorage.setItem(
          key,
          JSON.stringify({ overview: { title }, _wizardMeta: { resolvedFormProfile: "mountain_outdoor" } }),
        );
      },
      { key: denaliKey, title: marker },
    );

    const urbanCtx = await browser.newContext({ baseURL: urbanBase });
    const urbanPage = await urbanCtx.newPage();
    await loginWithPhoneOtp(urbanPage, "+989121000002");
    const crossRead = await urbanPage.evaluate((key) => localStorage.getItem(key), denaliKey);
    expect(crossRead).toBeNull();

    await denaliCtx.close();
    await urbanCtx.close();
  });
});
