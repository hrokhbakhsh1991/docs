import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCodedErrorMessage } from "../src/i18n/resolve-coded-error-message";

describe("resolveCodedErrorMessage (BUG-7)", () => {
  it("PORTAL-AUTH-ERR-01 maps BACKEND_UNREACHABLE", () => {
    const t = (key: string) => {
      if (key === "BACKEND_UNREACHABLE") {
        return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
      }
      if (key === "network") {
        return "خطایی رخ داد. دوباره تلاش کنید.";
      }
      return key;
    };
    assert.equal(
      resolveCodedErrorMessage(t, "BACKEND_UNREACHABLE"),
      "ارتباط با سرور برقرار نشد. دوباره تلاش کنید."
    );
  });

  it("PORTAL-AUTH-ERR-02 falls back to network for unknown codes", () => {
    const t = (key: string) => {
      if (key === "network") {
        return "خطایی رخ داد. دوباره تلاش کنید.";
      }
      return key;
    };
    assert.equal(resolveCodedErrorMessage(t, "BACKEND_UNREACHABLE"), "خطایی رخ داد. دوباره تلاش کنید.");
  });
});
