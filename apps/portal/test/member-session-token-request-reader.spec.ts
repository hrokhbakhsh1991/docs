import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { SESSION_TOKEN_COOKIE } from "../src/auth/build-session-cookie";
import { resolveMemberSessionTokenFromSources } from "../src/auth/read-member-session-token-from-request.server";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("member session token request reader", () => {
  it("prefers the explicit cookie-store value when present", () => {
    assert.equal(
      resolveMemberSessionTokenFromSources({
        cookieStoreValue: "session-from-store",
        rawCookieHeader: `${SESSION_TOKEN_COOKIE}=session-from-header`,
      }),
      "session-from-store"
    );
  });

  it("falls back to the raw Cookie header when cookie-store misses", () => {
    assert.equal(
      resolveMemberSessionTokenFromSources({
        cookieStoreValue: undefined,
        rawCookieHeader: `foo=bar; ${SESSION_TOKEN_COOKIE}=session-from-header; theme=dark`,
      }),
      "session-from-header"
    );
  });

  it("returns undefined when neither request source has the member token", () => {
    assert.equal(
      resolveMemberSessionTokenFromSources({
        cookieStoreValue: "",
        rawCookieHeader: "foo=bar; theme=dark",
      }),
      undefined
    );
  });

  it("wires the shared reader into both portal session and bearer-forwarding paths", () => {
    const sessionReader = readFileSync(
      join(repoRoot, "apps/portal/src/auth/read-public-catalog-session.server.ts"),
      "utf8"
    );
    const memberHeaders = readFileSync(
      join(repoRoot, "apps/portal/src/me/build-member-api-headers.server.ts"),
      "utf8"
    );

    assert.match(sessionReader, /readMemberSessionTokenFromRequest/);
    assert.match(memberHeaders, /readMemberSessionTokenFromRequest/);
    assert.doesNotMatch(memberHeaders, /cookies\(\)/);
  });
});
