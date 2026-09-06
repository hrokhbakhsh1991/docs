import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("fetch-member-profile.server — PCMS-REG-01 SSR cookie bind", () => {
  it("MP-SSR-01 fetchMemberProfile delegates to cookie-safe upstream, not loopback BFF", () => {
    const fetchModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-profile.server.ts"),
      "utf8"
    );
    const upstreamModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-profile-from-session.server.ts"),
      "utf8"
    );
    assert.match(fetchModule, /fetchMemberProfileUpstreamForHost/);
    assert.doesNotMatch(fetchModule, /\/api\/me\/profile/);
    assert.doesNotMatch(fetchModule, /identity\/me/);
    assert.match(upstreamModule, /identity\/me/);
    assert.match(upstreamModule, /buildMemberApiHeaders/);
    assert.match(upstreamModule, /readMemberCookieHeader/);
  });

  it("MP-SSR-02 fetchMemberProfileFromSession uses shared upstream helper", () => {
    const source = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-profile-from-session.server.ts"),
      "utf8"
    );
    assert.match(source, /fetchMemberProfileUpstreamForHost/);
    assert.match(source, /fetchMemberProfileFromSession/);
  });
});
