import assert from "node:assert/strict";
import { test } from "node:test";
import { createPasswordManagementClient } from "../src/password-management-client";

test("password management stays on the configured same-origin BFF and returns no credential", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; options: RequestInit }> = [];
  globalThis.fetch = (async (input, options) => {
    calls.push({ url: String(input), options: options ?? {} });
    const body = calls.length === 1 ? { ok: true, has_password: false } : calls.length === 2 ? { ok: true, challenge_id: "c1", otp_length: 4 } : { ok: true, session_token: "never-expose" };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    const client = createPasswordManagementClient("/api/me/password");
    assert.equal(await client.hasPassword(), false);
    assert.deepEqual(await client.requestOtp(), { challengeId: "c1", otpLength: 4 });
    assert.equal(await client.setPassword({ challengeId: "c1", otp: "3287", password: "test passphrase for case" }), undefined);
    assert.deepEqual(calls.map((call) => call.url), ["/api/me/password", "/api/me/password/request-otp", "/api/me/password"]);
    assert.equal(calls.every((call) => call.options.credentials === "same-origin"), true);
  } finally { globalThis.fetch = original; }
});
