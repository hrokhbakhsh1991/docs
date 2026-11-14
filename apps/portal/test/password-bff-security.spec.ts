import assert from "node:assert/strict";
import { test } from "node:test";
import { forwardMemberPassword } from "../src/auth/password-bff.server";
import { GET as passwordLoginAvailability } from "../app/api/public-auth/login-password/route";

test("member password writes reject missing and cross-site origins before accessing credentials", async () => {
  for (const origin of [undefined, "https://other.example"]) {
    for (const action of ["request-otp", "set"] as const) {
      const response = await forwardMemberPassword(
        new Request("http://portal.denali.localhost:3003/api/me/password", {
          method: "POST",
          ...(origin ? { headers: { origin } } : {}),
        }),
        action
      );
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, "ORIGIN_INVALID");
    }
  }
});

test("password login is advertised only when both the flag and ingress key are valid", async () => {
  const flag = process.env.PASSWORD_AUTH_ENABLED;
  const secret = process.env.PASSWORD_AUTH_INGRESS_SECRET;
  const nodeEnv = process.env.NODE_ENV;
  const mode = process.env.PASSWORD_AUTH_CLIENT_IP_MODE;
  try {
    process.env.PASSWORD_AUTH_ENABLED = "true";
    delete process.env.PASSWORD_AUTH_INGRESS_SECRET;
    assert.deepEqual(await passwordLoginAvailability().json(), { enabled: false });
    process.env.PASSWORD_AUTH_INGRESS_SECRET = "b".repeat(64);
    assert.deepEqual(await passwordLoginAvailability().json(), { enabled: true });
    process.env.NODE_ENV = "production";
    delete process.env.PASSWORD_AUTH_CLIENT_IP_MODE;
    assert.deepEqual(await passwordLoginAvailability().json(), { enabled: false });
    process.env.PASSWORD_AUTH_CLIENT_IP_MODE = "direct";
    assert.deepEqual(await passwordLoginAvailability().json(), { enabled: true });
    process.env.PASSWORD_AUTH_ENABLED = "false";
    assert.deepEqual(await passwordLoginAvailability().json(), { enabled: false });
  } finally {
    if (flag === undefined) delete process.env.PASSWORD_AUTH_ENABLED;
    else process.env.PASSWORD_AUTH_ENABLED = flag;
    if (secret === undefined) delete process.env.PASSWORD_AUTH_INGRESS_SECRET;
    else process.env.PASSWORD_AUTH_INGRESS_SECRET = secret;
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    if (mode === undefined) delete process.env.PASSWORD_AUTH_CLIENT_IP_MODE;
    else process.env.PASSWORD_AUTH_CLIENT_IP_MODE = mode;
  }
});
