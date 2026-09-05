/**
 * SMK-MKT-HEADER-02 — Profile B / bare-IP staging header login regression.
 * @see docs/phase-20/p7/appendices/P7-HOST-PARITY-PROFILE-B.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveIngressPluginId,
  resolvePortalMemberLoginUrl,
} from "@app-tour/guest-surface-host";

const marketingRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("marketing shell — Profile B staging login egress", () => {
  it("MKT-P8-01 layout passes bootstrap pluginId into portal login URL resolver", () => {
    const layout = readFileSync(path.join(marketingRoot, "app/layout.tsx"), "utf8");
    assert.match(layout, /resolvePortalMemberLoginUrl\(host, undefined, bootstrap\.pluginId\)/);
    assert.match(layout, /resolvePortalMemberModuleUrl\(host, undefined, bootstrap\.pluginId\)/);
    assert.match(
      layout,
      /resolveMarketingMemberHeader\(\s*host,\s*bootstrap\.tenantId,\s*bootstrap\.pluginId\s*\)/
    );
  });

  it("MKT-P8-02 bare VPS IP resolves login URL when fallback label env is present", () => {
    const previous = {
      label: process.env.PUBLIC_TENANT_FALLBACK_LABEL,
      hosts: process.env.PUBLIC_TENANT_FALLBACK_HOSTS,
      portal: process.env.PORTAL_PUBLIC_BASE_URL,
    };
    process.env.PUBLIC_TENANT_FALLBACK_LABEL = "denali";
    process.env.PUBLIC_TENANT_FALLBACK_HOSTS = "89.45.89.206";
    process.env.PORTAL_PUBLIC_BASE_URL = "http://89.45.89.206:23003";

    try {
      assert.equal(resolveIngressPluginId("89.45.89.206:23002"), "denali");
      assert.match(resolvePortalMemberLoginUrl("89.45.89.206:23002") ?? "", /\/login\?/);
    } finally {
      if (previous.label === undefined) delete process.env.PUBLIC_TENANT_FALLBACK_LABEL;
      else process.env.PUBLIC_TENANT_FALLBACK_LABEL = previous.label;
      if (previous.hosts === undefined) delete process.env.PUBLIC_TENANT_FALLBACK_HOSTS;
      else process.env.PUBLIC_TENANT_FALLBACK_HOSTS = previous.hosts;
      if (previous.portal === undefined) delete process.env.PORTAL_PUBLIC_BASE_URL;
      else process.env.PORTAL_PUBLIC_BASE_URL = previous.portal;
    }
  });
});
