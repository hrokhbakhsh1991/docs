import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");
const staging = read(".github/workflows/deploy-staging.yml");
const production = read(".github/workflows/deploy-vps.yml");
const adapter = read("scripts/ci/staging-deployment-adapter.sh");
const packageManager = JSON.parse(read("package.json")).packageManager;

test("dev deploys staging and manual dispatch admits only the validated Denali QA PR branch", () => {
  assert.match(staging, /branches:\s*\n\s*- dev/);
  assert.match(staging, /github\.ref == 'refs\/heads\/dev'/);
  assert.match(
    staging,
    /github\.event_name == 'workflow_dispatch'.*github\.ref == 'refs\/heads\/codex\/denali-final-approval-e2e'/s
  );
  assert.match(staging, /pull_request_number:/);
  assert.match(staging, /pr\.state !== 'open'/);
  assert.match(staging, /pr\.base\.ref !== 'dev'/);
  assert.match(staging, /pr\.head\.sha !== context\.sha/);
  assert.match(staging, /github\.rest\.checks\.listForRef/);
  assert.match(staging, /check\.status !== 'completed'/);
  assert.match(adapter, /STAGING_DISPATCH_EVENT.*workflow_dispatch/s);
  assert.match(adapter, /refs\/heads\/codex\/denali-final-approval-e2e/);
  assert.match(staging, /\/opt\/app-tour-staging/);
  assert.match(staging, /\/etc\/app-tour-staging/);
  assert.doesNotMatch(staging, /\/srv\/app-tour\b/);
});

test("main deploys production only and manual dispatch is ref-guarded", () => {
  assert.match(production, /branches:\s*\n\s*- main/);
  assert.match(production, /github\.ref == 'refs\/heads\/main'/);
  assert.match(production, /environment:\s*\n\s+name: production/);
  assert.match(production, /\/srv\/app-tour/);
  assert.doesNotMatch(production, /\/opt\/app-tour-staging/);
});

test("release branches have no automatic deployment trigger", () => {
  assert.doesNotMatch(staging, /- release\//);
  assert.doesNotMatch(production, /- release\//);
});

test("artifact release SHA is checked against the workflow commit and digest separately", () => {
  assert.match(staging, /releaseSha/);
  assert.match(staging, /sha256sum -c/);
  assert.match(staging, /JSON\.parse\(s\)\.releaseSha/);
  assert.match(staging, /\$GITHUB_SHA/);
});

test("production cannot use staging paths or pilot behavior", () => {
  assert.doesNotMatch(production, /STAGING_DEPLOY_ROOT|STAGING_ENV_DIR|pilot|seed-pilot/i);
  assert.match(production, /Production deployment path rejected/);
});

test("staging uses the repository-local guarded adapter contract", () => {
  assert.match(staging, /STAGING_ADAPTER_PATH/);
  assert.match(staging, /STAGING_ARTIFACT_DIGEST/);
  assert.match(staging, /STAGING_TENANT_SCOPE: pilot-only/);
  assert.match(staging, /verify-staging/);
  assert.match(adapter, /DEPLOY_TARGET.*staging/);
  assert.match(adapter, /STAGING_TENANT_SCOPE.*pilot-only/);
  assert.match(adapter, /BULK_TENANT_ENABLEMENT/);
});

test("staging bootstraps the pinned pnpm before setup-node cache", () => {
  const pinnedPnpm = packageManager.match(/^pnpm@(.+)$/)?.[1];
  assert.ok(pinnedPnpm, "package.json must pin pnpm");
  const pnpmSetup = staging.indexOf("uses: pnpm/action-setup@v4");
  const nodeSetup = staging.indexOf("uses: actions/setup-node@v4");
  assert.ok(pnpmSetup >= 0 && nodeSetup > pnpmSetup);
  assert.match(
    staging.slice(pnpmSetup, nodeSetup),
    new RegExp(`version: ${pinnedPnpm.replaceAll(".", "\\.")}`)
  );
  assert.match(staging.slice(nodeSetup), /cache: pnpm/);
});
