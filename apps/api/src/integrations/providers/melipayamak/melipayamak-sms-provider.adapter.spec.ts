import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MelipayamakSmsProviderAdapter } from "./melipayamak-sms-provider.adapter";

const context = {
  tenantId: "tenant-1",
  workspaceType: "denali",
  domainEventId: "otp-challenge-1",
  eventType: "auth.otp.requested",
  config: { bodyId: "12345", endpoint: "https://sms.test/BaseServiceNumber" },
  credentials: { username: "api-user", password: "api-password" },
} as const;

describe("Melipayamak SMS provider adapter", () => {
  it("sends a Pattern request without exposing credentials in the message payload", async () => {
    const originalFetch = globalThis.fetch;
    let requestUrl = "";
    let requestBody = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ recId: "1234567890123456" }), { status: 200 });
    }) as typeof fetch;

    try {
      const result = await new MelipayamakSmsProviderAdapter().sendSms(context, {
        recipient: "989121234567",
        templateId: "12345",
        variables: ["4821 دنالی"],
      });
      assert.deepEqual(result, { ok: true, providerMessageId: "1234567890123456" });
      assert.equal(requestUrl, "https://sms.test/BaseServiceNumber");
      assert.match(requestBody, /username=api-user/);
      assert.match(requestBody, /bodyId=12345/);
      assert.match(requestBody, /text=4821\+%D8%AF%D9%86%D8%A7%D9%84%DB%8C/);
      assert.match(requestBody, /to=989121234567/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails closed when credentials or sender line are missing", async () => {
    const adapter = new MelipayamakSmsProviderAdapter();
    assert.deepEqual(
      await adapter.sendSms(
        { ...context, credentials: {} },
        {
          recipient: "989121234567",
          templateId: "12345",
          variables: ["4821"],
        }
      ),
      { ok: false, errorCode: "MELIPAYAMAK_CREDENTIALS_MISSING" }
    );
    assert.deepEqual(
      await adapter.sendSms(
        { ...context, config: {} },
        {
          recipient: "989121234567",
          templateId: "",
          variables: ["4821"],
        }
      ),
      { ok: false, errorCode: "MELIPAYAMAK_SENDER_MISSING" }
    );
  });

  it("sends through the dedicated line with standard SendSMS when no Pattern exists", async () => {
    const originalFetch = globalThis.fetch;
    let requestUrl = "";
    let requestBody = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ value: "1234567890123456" }), { status: 200 });
    }) as typeof fetch;

    try {
      const result = await new MelipayamakSmsProviderAdapter().sendSms(
        { ...context, config: { sender: "50002710052870" } },
        { recipient: "989121234567", templateId: "", variables: ["1234"] }
      );
      assert.deepEqual(result, { ok: true, providerMessageId: "1234567890123456" });
      assert.equal(requestUrl, "https://rest.payamak-panel.com/api/SendSMS/SendSMS");
      assert.match(requestBody, /from=50002710052870/);
      assert.match(requestBody, /text=1234/);
      assert.match(requestBody, /isFlash=false/);
      assert.doesNotMatch(requestBody, /bodyId=/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("classifies provider failures without returning secret material", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ errorCode: "-4", errorMessage: "invalid body id" }), {
        status: 400,
      })) as typeof fetch;
    try {
      const result = await new MelipayamakSmsProviderAdapter().sendSms(context, {
        recipient: "989121234567",
        templateId: "12345",
        variables: ["4821"],
      });
      assert.deepEqual(result, {
        ok: false,
        errorCode: "MELIPAYAMAK_-4",
        errorMessage: "invalid body id",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
