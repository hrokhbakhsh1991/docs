import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const buildOrder = read("scripts/ci/build-api-workspace-deps.sh");
const workflow = read(".github/workflows/deploy-staging.yml");
const adapter = read("scripts/ci/staging-deployment-adapter.sh");

test("staging dependency install cannot dirty the artifact build checkout", () => {
  assert.match(workflow, /pnpm install --frozen-lockfile --ignore-scripts/);
});

test("staging generates Prisma client before directly invoking API tests", () => {
  const generateClient = workflow.indexOf("name: Generate API Prisma client");
  const expiryTests = workflow.indexOf("name: Payment hold scheduler and expiry focused tests");
  assert.notEqual(generateClient, -1, "fresh runners need a generated Prisma client");
  assert.ok(
    generateClient < expiryTests,
    "Prisma client generation must precede direct node tests"
  );
  assert.match(workflow, /pnpm --filter @apps\/api run prisma:generate/);
});

test("staging proves and normalizes only the known timestamped build report", () => {
  assert.match(workflow, /name: Prove clean artifact checkout/);
  assert.match(workflow, /docs\/phase-19\/architecture-truth-drift-report\.json/);
  assert.match(workflow, /git diff --name-only/);
  assert.match(workflow, /git ls-files --others --exclude-standard/);
  assert.match(workflow, /git restore --worktree --/);
  assert.match(workflow, /test -z "\$\(git status --porcelain\)"/);
});

test("build order materializes workspace-sdk runtime dependencies", () => {
  const packages = [
    "catalog-registration-auth",
    "booking-http-contracts",
    "tour-core",
    "workspace-sdk",
  ];
  const positions = packages.map((name) => {
    const position = buildOrder.indexOf(`pnpm --dir packages/${name} run build`);
    assert.notEqual(position, -1, `${name} missing from dependency build order`);
    return position;
  });
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b)
  );
});

test("staging exposes bounded focused test stages without broad globs", () => {
  for (const stage of [
    "Build workspace dependency artifacts",
    "Generate API Prisma client",
    "Wallet and API focused tests",
    "Workspace SDK focused tests",
    "Other changed tests",
  ]) {
    assert.match(workflow, new RegExp(`name: ${stage}`));
  }
  assert.doesNotMatch(workflow, /pnpm run test:changed/);
  assert.doesNotMatch(workflow, /test:\/\*\//);
});

test("staging bounds each focused stage independently", () => {
  assert.match(workflow, /timeout[^\n]+10m bash scripts\/ci\/build-api-workspace-deps\.sh/);
  assert.match(workflow, /timeout[^\n]+5m pnpm run test:wallet-staging-deploy-guards/);
  assert.match(workflow, /timeout[^\n]+10m bash -c 'cd packages\/workspace-sdk/);
  assert.match(
    workflow,
    /timeout[^\n]+5m node --test scripts\/test\/deployment-branch-contract\.spec\.mjs/
  );
});

test("staging verifies the downloaded artifact from its actual download layout", () => {
  assert.match(workflow, /path: dist\/staging-artifacts\/downloaded/);
  assert.match(workflow, /find "\$download_root" -type f -name 'app-tour-staging-\*\.tar\.zst'/);
  assert.match(workflow, /cd "\$\(dirname "\$artifact"\)"/);
  assert.match(workflow, /sha256sum -c "\$\(basename "\$digest_file"\)"/);
  assert.match(workflow, /release_sha=.*release-manifest\.json/);
  assert.match(workflow, /STAGING_ARTIFACT=%s/);
  assert.doesNotMatch(workflow, /sha256sum -c "\$\{artifact\}\.sha256"/);
});

test("staging passes the verified artifact through the transfer script contract", () => {
  assert.match(
    workflow,
    /ARTIFACT="\$STAGING_ARTIFACT" bash scripts\/vps-deploy\/deploy-staging-artifact-remote\.sh/
  );
});

test("staging artifact includes the guarded A-side identities seed entrypoint and wrapper", () => {
  const build = read("scripts/vps-deploy/build-staging-artifact.sh");
  const selfCheck = read("scripts/vps-deploy/lib/artifact-self-check.sh");
  const wrapper = read("scripts/vps-deploy/seed-denali-first-staging-identities-artifact.sh");

  assert.match(build, /seed-denali-first-staging-identities\.ts/);
  assert.match(build, /seed-denali-first-staging-identities\.cjs/);
  assert.match(build, /seed-denali-first-staging-identities-artifact\.sh/);
  assert.match(selfCheck, /seed-denali-first-staging-identities\.cjs/);
  assert.match(selfCheck, /seed-denali-first-staging-identities\.sh/);
  assert.match(wrapper, /\/etc\/app-tour-staging\/api\.env/);
  assert.match(wrapper, /\/opt\/app-tour-staging\/releases/);
  assert.match(wrapper, /seed-denali-first-staging-identities\.cjs/);
});

test("staging artifact includes the exact-target A-side identities cleanup entrypoint", () => {
  const build = read("scripts/vps-deploy/build-staging-artifact.sh");
  const selfCheck = read("scripts/vps-deploy/lib/artifact-self-check.sh");
  const wrapper = read("scripts/vps-deploy/cleanup-denali-first-staging-identities-artifact.sh");

  assert.match(build, /cleanup-denali-first-staging-identities\.ts/);
  assert.match(build, /cleanup-denali-first-staging-identities\.cjs/);
  assert.match(build, /cleanup-denali-first-staging-identities-artifact\.sh/);
  assert.match(selfCheck, /cleanup-denali-first-staging-identities\.cjs/);
  assert.match(selfCheck, /cleanup-denali-first-staging-identities\.sh/);
  assert.match(wrapper, /\/etc\/app-tour-staging\/api\.env/);
  assert.match(wrapper, /\/opt\/app-tour-staging\/releases/);
  assert.match(wrapper, /cleanup-denali-first-staging-identities\.cjs/);
});

test("staging artifact declares and verifies the A-side S2-E04 draft tour seed and cleanup", () => {
  const build = read("scripts/vps-deploy/build-staging-artifact.sh");
  const selfCheck = read("scripts/vps-deploy/lib/artifact-self-check.sh");
  const seedWrapper = read("scripts/vps-deploy/seed-denali-first-staging-draft-tour-artifact.sh");
  const cleanupWrapper = read(
    "scripts/vps-deploy/cleanup-denali-first-staging-draft-tour-artifact.sh"
  );
  const targetGuard = read("apps/api/scripts/lib/denali-first-staging-draft-tour-target.ts");
  const seed = read("apps/api/scripts/seed-denali-first-staging-draft-tour.ts");
  const cleanup = read("apps/api/scripts/cleanup-denali-first-staging-draft-tour.ts");

  for (const entry of [
    "seed-denali-first-staging-draft-tour.ts",
    "seed-denali-first-staging-draft-tour.cjs",
    "seed-denali-first-staging-draft-tour-artifact.sh",
    "cleanup-denali-first-staging-draft-tour.ts",
    "cleanup-denali-first-staging-draft-tour.cjs",
    "cleanup-denali-first-staging-draft-tour-artifact.sh",
  ]) {
    assert.ok(build.includes(entry), `artifact build omits ${entry}`);
  }
  for (const entry of [
    "seed-denali-first-staging-draft-tour.cjs",
    "seed-denali-first-staging-draft-tour.sh",
    "cleanup-denali-first-staging-draft-tour.cjs",
    "cleanup-denali-first-staging-draft-tour.sh",
  ]) {
    assert.ok(selfCheck.includes(entry), `self-check omits ${entry}`);
  }
  assert.match(build, /"denaliFirstStagingDraftTourSeedBundle": true/);
  assert.match(build, /"denaliFirstStagingDraftTourCleanupBundle": true/);
  assert.match(selfCheck, /denaliFirstStagingDraftTourSeedBundle/);
  assert.match(selfCheck, /denaliFirstStagingDraftTourCleanupBundle/);
  assert.match(seedWrapper, /\/opt\/app-tour-staging\/releases/);
  assert.match(targetGuard, /DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRM/);
  assert.match(targetGuard, /seed-denali-first-s2e-draft-tour-to-tour_db_staging/);
  assert.match(
    cleanupWrapper,
    /\/etc\/app-tour-staging\/denali-first-staging-draft-tour-manifests/
  );
  assert.match(targetGuard, /DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_CONFIRM/);
  assert.match(targetGuard, /cleanup-denali-first-s2e-draft-tour-from-tour_db_staging/);
  assert.match(
    seed,
    /console\.log\(JSON\.stringify\(buildFirstStagingDraftTourManifest\(plan\)\)\)/
  );
  assert.match(seedWrapper, /MANIFEST_ROOT="\/etc\/app-tour-staging"/);
  assert.match(
    seedWrapper,
    /MANIFEST_DIR="\$\{MANIFEST_ROOT\}\/denali-first-staging-draft-tour-manifests"/
  );
  assert.match(seedWrapper, /mktemp/);
  assert.match(seedWrapper, /cmp -s/);
  assert.match(seedWrapper, /flock -x 9/);
  const verifyManifestRoot = seedWrapper.indexOf('realpath -e "$MANIFEST_ROOT"');
  const createManifestDirectory = seedWrapper.indexOf('mkdir -p -m 0700 "$MANIFEST_DIR"');
  const rejectManifestSymlink = seedWrapper.indexOf('[[ ! -L "$MANIFEST_DIR" ]]');
  const verifyManifestPath = seedWrapper.indexOf('realpath -e "$MANIFEST_DIR"');
  const chmodManifestPath = seedWrapper.indexOf('chmod 0700 "$MANIFEST_DIR"');
  assert.notEqual(verifyManifestRoot, -1, "staging manifest parent must be canonical");
  assert.ok(verifyManifestRoot < createManifestDirectory, "verify manifest parent before mkdir");
  assert.notEqual(rejectManifestSymlink, -1, "symlink manifest directory must be rejected");
  assert.ok(createManifestDirectory < verifyManifestPath, "canonicalize the created manifest dir");
  assert.ok(
    rejectManifestSymlink < chmodManifestPath,
    "reject symlink before changing permissions"
  );
  assert.ok(verifyManifestPath < chmodManifestPath, "verify canonical path before chmod");
  const manifestPreflight = seedWrapper.indexOf("--manifest-only");
  const applySeed = seedWrapper.indexOf("--apply >");
  assert.notEqual(manifestPreflight, -1, "seed wrapper must calculate the exact manifest first");
  assert.ok(manifestPreflight < applySeed, "manifest conflicts must be rejected before DB writes");
  assert.ok(
    seedWrapper.indexOf("existing run manifest differs") < applySeed,
    "existing manifest mismatch must fail before DB writes"
  );
  assert.match(seedWrapper, /chmod 0600/);
  assert.match(seedWrapper, /RUN_ID.*\^\[a-zA-Z0-9\]\[a-zA-Z0-9\._-\]\{0,63\}\$/s);
  assert.match(cleanupWrapper, /RUN_ID.*\^\[a-zA-Z0-9\]\[a-zA-Z0-9\._-\]\{0,63\}\$/s);
  assert.match(cleanupWrapper, /MANIFEST_DIR_REAL.*==.*MANIFEST_DIR/);
  assert.match(seed, /tx\.tour\.create\(/);
  assert.match(seed, /isolationLevel: "Serializable"/);
  assert.match(seed, /manifestOnly/);
  assert.doesNotMatch(seed, /PrismaTourRepository|\.save\(plan\.tour\)/);
  assert.match(cleanup, /denaliExposureReminderActivation\.count\(/);
  assert.match(cleanup, /tourId: plan\.tour\.id/);
});

test("staging deploys and reloads the Profile C edge after artifact install", () => {
  const deploy = read("scripts/vps-deploy/deploy-staging-artifact-remote.sh");
  assert.match(deploy, /install-caddy-profile-c\.sh/);
  assert.match(deploy, /deploy\/vps\/caddy\/Caddyfile/);
  assert.match(deploy, /CADDY_SOURCE_CONFIG=/);
  assert.ok(
    deploy.indexOf("bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/install-staging-artifact.sh") <
      deploy.indexOf("bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/install-caddy-profile-c.sh"),
    "Caddy must be installed after artifact/env reconciliation"
  );
});

test("staging uploads the transfer manifest beside the artifact and checksum", () => {
  assert.match(
    workflow,
    /dist\/staging-artifacts\/\$\{\{ steps\.manifest\.outputs\.artifact \}\}\.manifest\.json/
  );
});

test("staging health verification uses the installed tooling layout", () => {
  assert.match(workflow, /VPS_DEPLOY_PATH: \$\{\{ env\.STAGING_DEPLOY_ROOT \}\}\/tooling/);
});

test("staging adapter receives VPS credentials and uses installed tooling", () => {
  assert.match(workflow, /VPS_HOST: \$\{\{ secrets\.VPS_HOST \}\}/);
  assert.match(workflow, /VPS_SSH_KEY: \$\{\{ secrets\.VPS_SSH_KEY \}\}/);
  assert.match(adapter, /VPS_DEPLOY_PATH="\$STAGING_DEPLOY_ROOT\/tooling"/);
});
