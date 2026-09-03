import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const buildOrder = read("scripts/ci/build-api-workspace-deps.sh");
const workflow = read(".github/workflows/deploy-staging.yml");

test("staging dependency install cannot dirty the artifact build checkout", () => {
  assert.match(workflow, /pnpm install --frozen-lockfile --ignore-scripts/);
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
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test("staging exposes bounded focused test stages without broad globs", () => {
  for (const stage of [
    "Build workspace dependency artifacts",
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
  assert.match(workflow, /timeout[^\n]+5m node --test scripts\/test\/deployment-branch-contract\.spec\.mjs/);
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
    /ARTIFACT="\$STAGING_ARTIFACT" bash scripts\/vps-deploy\/deploy-staging-artifact-remote\.sh/,
  );
});

test("staging uploads the transfer manifest beside the artifact and checksum", () => {
  assert.match(
    workflow,
    /dist\/staging-artifacts\/\$\{\{ steps\.manifest\.outputs\.artifact \}\}\.manifest\.json/,
  );
});
