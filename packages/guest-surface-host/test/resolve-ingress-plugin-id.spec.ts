import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  resolveIngressPluginId,
  resolvePortalMemberLoginUrl,
  resolvePortalMemberModuleUrl,
} from "../src/index";
import { resolveProductionIngressLabelFromHost } from "../src/resolve-production-ingress-label";

const ENV_KEYS = [
  "PORTAL_PUBLIC_BASE_URL",
  "PUBLIC_TENANT_FALLBACK_LABEL",
  "PUBLIC_TENANT_FALLBACK_HOSTS",
  "TOUR_OPS_PUBLIC_FALLBACK_HOSTS",
  "TOUR_OPS_DEFAULT_TENANT_ID",
  "PLATFORM_ROOT_DOMAIN",
] as const;

const previousEnv = new Map<string, string | undefined>();

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined): void {
  if (!previousEnv.has(key)) {
    previousEnv.set(key, process.env[key]);
  }
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  for (const [key, value] of previousEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  previousEnv.clear();
});

describe("resolveProductionIngressLabelFromHost — P8 Profile B", () => {
  it("GSH-P8-01 raw VPS IP resolves fallback label when allowlisted", () => {
    setEnv("PUBLIC_TENANT_FALLBACK_LABEL", "denali");
    setEnv("PUBLIC_TENANT_FALLBACK_HOSTS", "89.45.89.206");
    assert.equal(resolveProductionIngressLabelFromHost("89.45.89.206:23002"), "denali");
  });

  it("GSH-P8-02 TOUR_OPS_PUBLIC_FALLBACK_HOSTS aliases PUBLIC_TENANT_FALLBACK_HOSTS", () => {
    setEnv("PUBLIC_TENANT_FALLBACK_LABEL", "operator");
    setEnv("TOUR_OPS_PUBLIC_FALLBACK_HOSTS", "89.45.89.206");
    assert.equal(resolveProductionIngressLabelFromHost("89.45.89.206"), "operator");
  });
});

describe("resolveIngressPluginId — staging marketing header login", () => {
  it("GSH-P8-03 bare IP resolves plugin via PUBLIC_TENANT_FALLBACK_LABEL", () => {
    setEnv("PUBLIC_TENANT_FALLBACK_LABEL", "denali");
    setEnv("PUBLIC_TENANT_FALLBACK_HOSTS", "89.45.89.206");
    assert.equal(resolveIngressPluginId("89.45.89.206:23002"), "denali");
  });

  it("GSH-P8-04 explicit bootstrap pluginId overrides host parsing", () => {
    assert.equal(resolveIngressPluginId("89.45.89.206:23002", "denali"), "denali");
  });

  it("GSH-P8-05 member login URL is non-null for Profile B IP ingress", () => {
    setEnv("PORTAL_PUBLIC_BASE_URL", "http://89.45.89.206:23003");
    setEnv("PUBLIC_TENANT_FALLBACK_LABEL", "denali");
    setEnv("PUBLIC_TENANT_FALLBACK_HOSTS", "89.45.89.206");
    assert.equal(
      resolvePortalMemberLoginUrl("89.45.89.206:23002"),
      "http://89.45.89.206:23003/login?portalReturn=%2Fme%2Fregistrations"
    );
  });

  it("GSH-P8-06 bootstrap pluginId builds login URL even without fallback env", () => {
    setEnv("PORTAL_PUBLIC_BASE_URL", "http://89.45.89.206:23003");
    assert.equal(
      resolvePortalMemberLoginUrl("89.45.89.206:23002", undefined, "denali"),
      "http://89.45.89.206:23003/login?portalReturn=%2Fme%2Fregistrations"
    );
  });

  it("GSH-P8-07 member module URL resolves for Profile B IP ingress", () => {
    setEnv("PORTAL_PUBLIC_BASE_URL", "http://89.45.89.206:23003");
    setEnv("PUBLIC_TENANT_FALLBACK_LABEL", "denali");
    setEnv("PUBLIC_TENANT_FALLBACK_HOSTS", "89.45.89.206");
    assert.equal(
      resolvePortalMemberModuleUrl("89.45.89.206:23002", "profile"),
      "http://89.45.89.206:23003/me/profile"
    );
  });
});
