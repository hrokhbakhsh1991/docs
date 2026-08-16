import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("portal public-auth session probe — PCMS-CORS-05", () => {
  it("PCMS-CORS-P4-11 GET /api/public-auth/session is a boolean probe", async () => {
    const { GET } = await import("../app/api/public-auth/session/route");
    const res = await GET(
      new Request("http://portal.denali.club:3003/api/public-auth/session", {
        method: "GET",
        headers: { host: "portal.denali.club:3003" },
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok?: boolean;
      ready?: boolean;
      session_token?: unknown;
      user_id?: unknown;
    };
    assert.equal(body.ok, true);
    assert.equal(body.ready, false);
    assert.equal(body.session_token, undefined);
    assert.equal(body.user_id, undefined);
  });

  it("PCMS-CORS-P4-12 session route does not proxy member profile", () => {
    const src = readFileSync(join(portalRoot, "app/api/public-auth/session/route.ts"), "utf8");
    assert.match(src, /readPublicCatalogSessionFromCookies/);
    assert.match(src, /sessionMemberMatchesPortalTenant/);
    assert.doesNotMatch(src, /\/api\/me\/profile/);
    assert.doesNotMatch(src, /session_token/);
    assert.doesNotMatch(src, /displayName/);
  });
});
