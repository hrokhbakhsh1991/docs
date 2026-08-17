import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMarketingLoginError } from "../src/auth/resolve-marketing-login-error";

describe("resolveMarketingLoginError (BUG-7)", () => {
  it("MKT-AUTH-ERR-01 maps BACKEND_UNREACHABLE to catalog copy", () => {
    const t = (key: string) => {
      if (key === "errors.BACKEND_UNREACHABLE") {
        return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
      }
      if (key === "errors.network") {
        return "خطایی رخ داد. دوباره تلاش کنید.";
      }
      return key;
    };
    assert.equal(
      resolveMarketingLoginError(t, "BACKEND_UNREACHABLE"),
      "ارتباط با سرور برقرار نشد. دوباره تلاش کنید."
    );
  });

  it("MKT-AUTH-ERR-02 falls back to network when the code key is missing", () => {
    const t = (key: string) => {
      if (key === "errors.network") {
        return "خطایی رخ داد. دوباره تلاش کنید.";
      }
      return key;
    };
    assert.equal(resolveMarketingLoginError(t, "BACKEND_UNREACHABLE"), "خطایی رخ داد. دوباره تلاش کنید.");
  });
});
