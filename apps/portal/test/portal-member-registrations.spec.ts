/**
 * P6-3 — portal member registrations BFF
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { mergeCatalogRegistrationHeaders } from "../src/catalog/build-catalog-registration-headers.server";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-member-registrations", () => {
  it("MEM-BFF-01 fetchMemberRegistrations uses same-origin registrations BFF", () => {
    const fetchModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-registrations.server.ts"),
      "utf8"
    );
    assert.match(fetchModule, /\/api\/me\/registrations/);
    assert.match(fetchModule, /cookieHeader\.length === 0/);
    assert.match(fetchModule, /return \[\]/);
    assert.doesNotMatch(fetchModule, /bookings\?view=mine/);
    assert.doesNotMatch(fetchModule, /resolveTourOpsApiBaseUrl/);
  });

  it("MEM-BFF-02 GET route proxies bookings upstream with member headers", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/route.ts"),
      "utf8"
    );
    assert.match(route, /headers\.Authorization === undefined/);
    assert.match(route, /AUTH_UNAUTHENTICATED/);
    assert.match(route, /status: 401/);
    assert.match(route, /bookings\?view=mine&limit=50/);
    assert.match(route, /buildMemberApiHeaders/);
    assert.doesNotMatch(route, /fetchMemberRegistrations/);
  });

  it("MEM-BFF-02b member session headers include workspace id", () => {
    const tenantId = "00000000-0000-4000-8000-000000000014";
    const headers = mergeCatalogRegistrationHeaders(tenantId, {
      tenantId,
      userId: "00000000-0000-4000-8000-000000000103",
      workspaceId: "ws-operator-smoke-member",
      role: "member",
    });
    assert.equal(headers["x-workspace-id"], "ws-operator-smoke-member");
    assert.equal(headers["x-user-id"], "00000000-0000-4000-8000-000000000103");
  });

  it("MEM-BFF-03 /me/registrations page SSR marker", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/page.tsx"),
      "utf8"
    );
    assert.match(page, /main data-portal-member-registrations/);
    assert.match(page, /data-portal-member-registration-row/);
    assert.match(page, /data-portal-member-registration-status-badge/);
    assert.match(page, /data-portal-member-registrations-empty-cta/);
    assert.match(page, /fetchMemberRegistrations/);
  });

  it("MEM-BFF-04 /me/registrations detail page markers", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/page.tsx"),
      "utf8"
    );
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx"),
      "utf8"
    );
    assert.match(page, /main data-portal-member-registration-detail/);
    assert.match(page, /resolveMemberPortalTripsListPath/);
    assert.match(form, /data-portal-member-receipt-upload/);
    assert.match(form, /data-portal-member-receipt-submit/);
    assert.match(form, /disabled=\{status === "uploading"\}/);
  });

  it("MEM-SKIN-01 denali-portal.css covers member registrations surfaces", () => {
    const skin = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/denali-portal.css"),
      "utf8"
    );
    assert.match(skin, /main\[data-portal-member-registrations\]/);
    assert.match(skin, /\[data-portal-member-registration-status-badge\]/);
    assert.match(skin, /\[data-portal-member-registrations-empty-cta\]/);
    assert.match(skin, /main\[data-portal-member-home\]/);
    assert.match(skin, /\[data-portal-member-home-quick-links\]/);
    assert.match(skin, /main\[data-portal-member-module-stub\]/);
    assert.match(skin, /main\[data-portal-member-registration-detail\]/);
    assert.match(skin, /\[data-portal-member-receipt-upload\]/);
    assert.match(skin, /\[data-public-auth-logout\]/);
  });

  it("MEM-AUTH-02 member shell wires logout BFF", () => {
    const userMenu = readFileSync(
      join(repoRoot, "apps/portal/src/shell/portal-member-user-menu.tsx"),
      "utf8"
    );
    const logoutButton = readFileSync(
      join(repoRoot, "apps/portal/src/me/member-logout-button.tsx"),
      "utf8"
    );
    const logoutRoute = readFileSync(
      join(repoRoot, "apps/portal/app/api/public-auth/logout/route.ts"),
      "utf8"
    );
    assert.match(userMenu, /MemberLogoutButton/);
    assert.match(logoutButton, /data-public-auth-logout/);
    assert.match(logoutButton, /data-public-auth-logout-ready/);
    assert.match(logoutButton, /\/api\/public-auth\/logout/);
    assert.match(logoutRoute, /clearSessionCookieOnResponse/);
  });

  it("MEM-I18N-01 portalMember messages loaded for fa and en", () => {
    const loadMessages = readFileSync(
      join(repoRoot, "apps/portal/src/i18n/load-messages.ts"),
      "utf8"
    );
    assert.match(loadMessages, /portalMember\.json/);
    const fa = readFileSync(join(repoRoot, "apps/portal/messages/fa/portalMember.json"), "utf8");
    const en = readFileSync(join(repoRoot, "apps/portal/messages/en/portalMember.json"), "utf8");
    assert.match(fa, /"trips"/);
    assert.match(en, /"trips"/);
  });

  it("MEM-PROF-01 profile page uses canonical profile BFF", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/me/profile/page.tsx"), "utf8");
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/profile/member-profile-form.tsx"),
      "utf8"
    );
    assert.match(page, /fetchMemberProfile/);
    assert.match(page, /<main[^>]*data-portal-member-profile/);
    assert.match(form, /data-portal-member-profile/);
    assert.match(form, /data-member-profile-ready/);
    assert.match(form, /MemberProfileGenderField/);
    assert.match(form, /data-member-profile-save/);
    assert.match(form, /type="button"/);
    assert.match(form, /\/api\/me\/profile/);
    assert.doesNotMatch(form, /session-profile/);
  });
});
