/**
 * P6-3 — portal member registrations BFF
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-member-registrations", () => {
  it("MEM-BFF-01 member registrations fetch uses bookings?view=mine", () => {
    const fetchModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-registrations.server.ts"),
      "utf8"
    );
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/route.ts"),
      "utf8"
    );
    assert.match(fetchModule, /bookings\?view=mine/);
    assert.match(route, /fetchMemberRegistrations/);
  });

  it("MEM-BFF-02 /me/registrations page exists", () => {
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
