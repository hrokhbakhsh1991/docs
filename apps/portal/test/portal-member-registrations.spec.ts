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
  it("MEM-BFF-01 fetchMemberRegistrations short-circuits without Authorization", () => {
    const fetchModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-registrations.server.ts"),
      "utf8"
    );
    assert.match(fetchModule, /headers\.Authorization === undefined/);
    assert.match(fetchModule, /return \[\]/);
    assert.match(fetchModule, /bookings\?view=mine&limit=50/);
  });

  it("MEM-BFF-02 GET route returns 401 when Authorization missing", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/route.ts"),
      "utf8"
    );
    assert.match(route, /headers\.Authorization === undefined/);
    assert.match(route, /AUTH_UNAUTHENTICATED/);
    assert.match(route, /status: 401/);
    assert.match(route, /fetchMemberRegistrations/);
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
    assert.match(page, /data-portal-member-registrations/);
    assert.match(page, /fetchMemberRegistrations/);
  });

  it("MEM-I18N-01 portalMember messages loaded for fa and en", () => {
    const loadMessages = readFileSync(
      join(repoRoot, "apps/portal/src/i18n/load-messages.ts"),
      "utf8"
    );
    assert.match(loadMessages, /portalMember\.json/);
    const fa = readFileSync(join(repoRoot, "apps/portal/messages/fa/portalMember.json"), "utf8");
    const en = readFileSync(join(repoRoot, "apps/portal/messages/en/portalMember.json"), "utf8");
    assert.match(fa, /"title"/);
    assert.match(en, /"title"/);
  });
});
