import {
  defineTwoTenantStagingConfig,
  loadTwoTenantStagingManifest,
} from "../fixtures/two-tenant-staging-config.mts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const manifest = loadTwoTenantStagingManifest();

const ownerMobile = process.env.DENALI_SECOND_STAGING_OWNER_MOBILE?.trim() ?? "";
const financeMobile = process.env.DENALI_SECOND_STAGING_FINANCE_MOBILE?.trim() ?? "";
if (!/^\+1555\d{7}$/.test(ownerMobile) || !/^\+1555\d{7}$/.test(financeMobile)) {
  throw new Error("S2_E12 requires the reserved synthetic tenant-B Owner and Finance identities");
}
if (ownerMobile === financeMobile) {
  throw new Error("S2_E12 requires separate tenant-B Owner and Finance identities");
}
if (
  process.env.STAGING_ALLOW_STATIC_OTP?.trim() !== "true" ||
  process.env.SMS_OTP_ENABLED?.trim().toLowerCase() === "true"
) {
  throw new Error("S2_E12 requires static staging OTP with SMS delivery disabled");
}
if (process.env.APP_INFRA_PROFILE?.trim() !== "staging") {
  throw new Error("S2_E12 requires the staging infrastructure profile");
}
const localProxy = process.env.DENALI_SECOND_STAGING_LOCAL_PROXY?.trim() ?? "";
if (localProxy !== "http://127.0.0.1:9443") {
  throw new Error("S2_E12 requires the approved loopback TLS tunnel proxy");
}
const caPath = process.env.DENALI_SECOND_STAGING_CADDY_ROOT_CA?.trim() ?? "";
const caSha256 = process.env.DENALI_SECOND_STAGING_CADDY_ROOT_CA_SHA256?.trim() ?? "";
if (!/^[a-f0-9]{64}$/i.test(caSha256) || caPath.length === 0) {
  throw new Error("S2_E12 requires the pinned staging CA");
}
if (createHash("sha256").update(readFileSync(caPath)).digest("hex") !== caSha256.toLowerCase()) {
  throw new Error("S2_E12 staging CA pin mismatch");
}

process.env.DENALI_SECOND_STAGING_E12 = "1";
process.env.OPERATOR_OWNER_MOBILE = ownerMobile;
process.env.DENALI_STAGING_B_ADMIN_URL = manifest.tenants.B.hosts.admin;
process.env.DENALI_STAGING_B_MARKETING_URL = manifest.tenants.B.hosts.marketing;
process.env.DENALI_STAGING_B_PORTAL_URL = manifest.tenants.B.hosts.portal;
process.env.SMOKE_OPERATOR_WEB_BASE_URL = manifest.tenants.B.hosts.admin;
process.env.SMOKE_DENALI_ADMIN_BASE_URL = manifest.tenants.B.hosts.admin;
process.env.SMOKE_MARKETING_OPERATOR_BASE_URL = manifest.tenants.B.hosts.marketing;
process.env.SMOKE_PORTAL_OPERATOR_BASE_URL = manifest.tenants.B.hosts.portal;

export default defineTwoTenantStagingConfig({
  tenantLabel: "B",
  tenantLabels: ["B"],
  testDir: "../../tests/e2e",
  testMatch: "tour-creation-paid-partial-receipt-staging.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 600_000,
  use: {
    baseURL: process.env.DENALI_STAGING_B_ADMIN_URL,
    proxy: { server: localProxy },
    screenshot: "off",
    trace: "off",
    video: "off",
    serviceWorkers: "block",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
});
