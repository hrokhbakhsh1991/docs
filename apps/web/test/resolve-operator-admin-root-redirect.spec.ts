/**
 * P6 — club admin host has no public home; `/` → operator dashboard.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { OPERATOR_DASHBOARD_PATH } from "../src/admin/require-operator-session";
import { resolveOperatorAdminRootRedirect } from "../src/admin/resolve-operator-admin-root-redirect";

describe("resolve-operator-admin-root-redirect.spec.ts — P6 admin home", () => {
  it("P6-ADM-ROOT-01 canonical club admin `/` redirects to dashboard", () => {
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/",
        host: "admin.denali.localhost:3000",
      }),
      OPERATOR_DASHBOARD_PATH
    );
  });

  it("P6-ADM-ROOT-01b legacy club admin `/` redirects to dashboard", () => {
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/",
        host: "denali.admin.localhost:3000",
      }),
      OPERATOR_DASHBOARD_PATH
    );
  });

  it("P6-ADM-ROOT-02 legacy dev club apex `/` is not an admin home (308 elsewhere)", () => {
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/",
        host: "denali.localhost:3000",
      }),
      null
    );
  });

  it("P6-ADM-ROOT-03 portal host does not redirect `/`", () => {
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/",
        host: "denali.portal.localhost:3003",
      }),
      null
    );
  });

  it("P6-ADM-ROOT-04 non-root paths are unchanged", () => {
    assert.equal(
      resolveOperatorAdminRootRedirect({
        pathname: "/tours",
        host: "denali.admin.localhost:3000",
      }),
      null
    );
  });

  it("middleware wires operator admin root redirect", () => {
    const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
    assert.match(source, /resolveOperatorAdminRootRedirect/);
  });
});
