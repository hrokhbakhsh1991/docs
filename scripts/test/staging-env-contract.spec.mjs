/**
 * Staging env/deploy contract guards — Denali Profile B (89.42.210.252).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const STAGING_IP = "89.42.210.252";
const LEGACY_IP = "89.45.89.206";

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("staging-env-contract", () => {
  it("REG-STG-ENV-01 wave-c bootstrap sets denali fallback, MinIO public endpoint, portal internal URL", () => {
    const sh = read("scripts/wave-c-staging-env-bootstrap.sh");
    assert.match(sh, /STAGING_PUBLIC_IP="\$\{STAGING_PUBLIC_IP:-89\.42\.210\.252\}"/);
    assert.match(sh, /MINIO_PUBLIC_ENDPOINT=http:\/\/\$\{STAGING_PUBLIC_IP\}:9002/);
    assert.match(sh, /PORTAL_INTERNAL_URL=http:\/\/127\.0\.0\.1:23003/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_LABEL=denali/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_HOSTS=\$\{FALLBACK_HOSTS\}/);
    assert.doesNotMatch(sh, new RegExp(LEGACY_IP));
  });

  it("REG-STG-ENV-02 profile-b sync sets api MINIO_PUBLIC_ENDPOINT and portal PORTAL_INTERNAL_URL", () => {
    const sh = read("scripts/vps-deploy/sync-staging-profile-b-public-urls.sh");
    assert.match(sh, /MINIO_PUBLIC_ENDPOINT/);
    assert.match(sh, /PORTAL_INTERNAL_URL/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_LABEL "\$CLUB_LABEL"/);
    assert.match(sh, /PUBLIC_TENANT_FALLBACK_HOSTS/);
    assert.match(sh, /portal\.%s\.localhost/);
    assert.match(sh, /MARKETING_PUBLIC_BASE_URL/);
    assert.match(sh, /PLATFORM_ROOT_DOMAIN localhost/);
  });

  it("REG-STG-ENV-03 active staging deploy scripts default to canonical staging IP", () => {
    const paths = [
      "scripts/vps-deploy/bootstrap-staging.sh",
      "scripts/vps-deploy/sync-staging-web-build.sh",
      "scripts/p8-staging-remote-smoke.sh",
      "scripts/p10-vps-smoke.sh",
      "scripts/smoke-p8-profile-b.mjs",
    ];
    for (const rel of paths) {
      const text = read(rel);
      assert.match(text, new RegExp(STAGING_IP), `${rel} missing canonical staging IP default`);
      assert.doesNotMatch(text, new RegExp(LEGACY_IP), `${rel} still references legacy staging IP`);
    }
  });

  it("REG-STG-ENV-04 staging env examples document denali + canonical IP", () => {
    const apiExample = read("deploy/vps/env/api.env.example");
    const marketingExample = read("deploy/vps/env/marketing.env.example");
    assert.match(apiExample, /PUBLIC_TENANT_FALLBACK_LABEL=denali/);
    assert.match(apiExample, new RegExp(`${STAGING_IP},127\\.0\\.0\\.1`));
    assert.match(marketingExample, new RegExp(STAGING_IP));
    assert.doesNotMatch(apiExample, new RegExp(LEGACY_IP));
    assert.doesNotMatch(marketingExample, new RegExp(LEGACY_IP));
  });
});
