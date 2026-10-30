import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveOperatorSessionPluginIdForHost } from "../src/auth/resolve-operator-session-plugin.server";

const TENANT_A = "00000000-0000-4000-8000-000000000003";
const TENANT_B = "f0ed9e65-2638-4351-847d-724f87ebbfce";
const B_ADMIN_HOST = "admin.qa2.staging.test";

describe("authenticated operator session plugin resolution", () => {
  it("uses the host bootstrap plugin when its tenant matches the validated session", async () => {
    const pluginId = await resolveOperatorSessionPluginIdForHost(
      TENANT_B,
      B_ADMIN_HOST,
      async (host) => {
        assert.equal(host, B_ADMIN_HOST);
        return { tenantId: TENANT_B, pluginId: "denali" };
      }
    );

    assert.equal(pluginId, "denali");
  });

  it("fails closed when the validated session tenant differs from the host tenant", async () => {
    const pluginId = await resolveOperatorSessionPluginIdForHost(
      TENANT_A,
      B_ADMIN_HOST,
      async () => ({
        tenantId: TENANT_B,
        pluginId: "denali",
      })
    );

    assert.equal(pluginId, null);
  });

  it("fails closed when the host bootstrap cannot resolve", async () => {
    const pluginId = await resolveOperatorSessionPluginIdForHost(
      TENANT_B,
      B_ADMIN_HOST,
      async () => {
        throw new Error("ADMIN_TENANT_UNRESOLVED");
      }
    );

    assert.equal(pluginId, null);
  });

  it("fails closed when the resolved workspace plugin ID is empty", async () => {
    const pluginId = await resolveOperatorSessionPluginIdForHost(
      TENANT_B,
      B_ADMIN_HOST,
      async () => ({
        tenantId: TENANT_B,
        pluginId: "  ",
      })
    );

    assert.equal(pluginId, null);
  });
});
