/**
 * Phase 9.2 — admin shell session guard scaffold
 * Authority: docs/phase-9/subphases/9.2-admin-shell.md · INV-P9-007
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  OPERATOR_WIZARD_PATH,
  requireOperatorSessionWeb,
} from "../src/admin/require-operator-session";
import { resolveOperatorNav } from "../src/admin/shell/resolve-operator-nav";
import { OPERATOR_NAV_TEST_IDS } from "../src/admin/shell/operator-nav.types";

describe("admin-shell-access.spec.ts — Phase 9.2", () => {
  it("CP-9.2-01 anonymous GET /dashboard requires login redirect", () => {
    const result = requireOperatorSessionWeb({ session: null, pathname: "/dashboard" });
    assert.equal(result.allowed, false);
  });

  it("CP-9.2-02 authenticated owner session allows dashboard", () => {
    const result = requireOperatorSessionWeb({
      session: {
        userId: "00000000-0000-4000-8000-000000000001",
        tenantId: "00000000-0000-4000-8000-000000000002",
        role: "owner",
        workspaceType: "denali",
      },
      pathname: "/dashboard",
    });
    assert.equal(result.allowed, true);
  });

  it("CP-9.2-03 admin session denied owner panel (DEC-P9-018)", () => {
    const result = requireOperatorSessionWeb({
      session: {
        userId: "00000000-0000-4000-8000-000000000103",
        tenantId: "00000000-0000-4000-8000-000000000002",
        role: "admin",
        workspaceType: "denali",
      },
      pathname: "/dashboard",
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.match(result.redirectTo, /access=owner-only/);
    }
  });

  it("CP-9.2-04 resolveOperatorNav includes dashboard and tours", () => {
    const items = resolveOperatorNav({
      session: {
        userId: "00000000-0000-4000-8000-000000000001",
        tenantId: "00000000-0000-4000-8000-000000000002",
        role: "owner",
        workspaceType: "denali",
      },
      pluginId: "denali",
    });
    assert.ok(items.some((item) => item.href === "/dashboard"));
    assert.ok(items.some((item) => item.href === "/tours"));
  });

  it("CP-9.2-05 admin nav excludes owner-only sections (DEC-P9-018)", () => {
    const items = resolveOperatorNav({
      session: {
        userId: "00000000-0000-4000-8000-000000000103",
        tenantId: "00000000-0000-4000-8000-000000000002",
        role: "admin",
        workspaceType: "denali",
      },
      pluginId: "denali",
    });
    assert.ok(items.some((item) => item.href === "/dashboard"));
    assert.ok(items.some((item) => item.href === "/bookings"));
    assert.equal(
      items.some((item) => item.href === "/users"),
      false
    );
    assert.equal(
      items.some((item) => item.href === "/settings"),
      false
    );
    assert.equal(
      items.some((item) => item.href === "/finance"),
      false
    );
  });

  it("CP-9.2-10 users nav hidden on urban tenant (INV-P9-006)", () => {
    const items = resolveOperatorNav({
      session: {
        userId: "00000000-0000-4000-8000-000000000001",
        tenantId: "00000000-0000-4000-8000-000000000004",
        role: "owner",
        workspaceType: "urban",
      },
      pluginId: "urban",
    });
    assert.equal(
      items.some((item) => item.href === "/users"),
      false
    );
  });

  it("CP-9.2-08 finance nav hidden on urban tenant (ASM-9.2-009)", () => {
    const items = resolveOperatorNav({
      session: {
        userId: "00000000-0000-4000-8000-000000000001",
        tenantId: "00000000-0000-4000-8000-000000000004",
        role: "owner",
        workspaceType: "urban",
      },
      pluginId: "urban",
    });
    assert.equal(
      items.some((item) => item.href === "/finance"),
      false
    );
  });

  it("CP-9.2-09 new tour CTA targets wizard path (DEC-P9-007)", () => {
    assert.equal(OPERATOR_WIZARD_PATH, "/tours/new");
    assert.equal(OPERATOR_NAV_TEST_IDS.newTourCta, "operator-new-tour-cta");
  });

  it("CP-9.2-11 workspace capability links append after platform links", () => {
    const items = resolveOperatorNav({
      session: {
        userId: "00000000-0000-4000-8000-000000000001",
        tenantId: "00000000-0000-4000-8000-000000000002",
        role: "owner",
        workspaceType: "alpine",
      },
      pluginId: "alpine",
      workspaceLinks: [{ href: "/catalog", labelKey: "catalog" }],
    });
    assert.deepEqual(
      items.slice(0, 3).map((item) => item.href),
      ["/dashboard", "/tours", "/bookings"]
    );
    assert.deepEqual(items.at(-1), {
      pathKey: "workspace:/catalog",
      href: "/catalog",
      labelKey: "catalog",
      labelNamespace: "tours.shell",
    });
  });

  it("CP-9.2-12 invalid workspace links fail closed and owner visibility remains enforced", () => {
    const links = [
      { href: "//external.example", labelKey: "external" },
      { href: "catalog", labelKey: "relative" },
      { href: "/missing-label", labelKey: "" },
      { href: "/valid", labelKey: "valid" },
    ];
    const ownerItems = resolveOperatorNav({
      session: {
        userId: "owner",
        tenantId: "tenant",
        role: "owner",
        workspaceType: "alpine",
      },
      pluginId: "alpine",
      workspaceLinks: links,
    });
    assert.equal(
      ownerItems.some((item) => item.href === "/valid"),
      true
    );
    assert.equal(
      ownerItems.some((item) => item.href === "catalog"),
      false
    );
    assert.equal(
      ownerItems.some((item) => item.href === "//external.example"),
      false
    );

    const memberItems = resolveOperatorNav({
      session: {
        userId: "member",
        tenantId: "tenant",
        role: "member",
        workspaceType: "alpine",
      },
      pluginId: "alpine",
      workspaceLinks: links,
    });
    assert.equal(
      memberItems.some((item) => item.href === "/valid"),
      false
    );
  });

  it("CP-9.2-13 primary nav composition has no product-ID branch", () => {
    const source = readFileSync("src/admin/shell/resolve-operator-nav.ts", "utf8");
    assert.doesNotMatch(source, /denali|alpine|urban/i);
    assert.match(source, /workspaceLinks/);
  });
});
