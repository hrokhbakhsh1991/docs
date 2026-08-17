import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveClubApexToAdminRedirect } from "../src/tenant/resolve-club-apex-to-admin-redirect";

describe("resolve-club-apex-to-admin-redirect.spec.ts — WRS-ADMIN-LEGACY-308", () => {
  it("WRS-ADM-308-01 club apex on web redirects to club admin host", () => {
    assert.equal(
      resolveClubApexToAdminRedirect({
        host: "denali.localhost:3000",
        pathname: "/tours",
        search: "?status=all",
      }),
      "http://denali.admin.localhost:3000/tours?status=all"
    );
  });

  it("WRS-ADM-308-02 canonical club admin host is not redirected", () => {
    assert.equal(
      resolveClubApexToAdminRedirect({
        host: "denali.admin.localhost:3000",
        pathname: "/tours",
        search: "",
      }),
      null
    );
  });

  it("WRS-ADM-308-03 portal host is not redirected", () => {
    assert.equal(
      resolveClubApexToAdminRedirect({
        host: "denali.portal.localhost:3003",
        pathname: "/",
        search: "",
      }),
      null
    );
  });
});
