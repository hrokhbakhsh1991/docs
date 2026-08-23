#!/usr/bin/env node
/** PROD-8 R8-02..R8-06 — immutable release bundle manifest, checksums, SBOM, provenance, fingerprint. */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const doBuild = args.includes("--build");
const artifactRootIdx = args.indexOf("--artifact-root");
const artifactRootArg = artifactRootIdx >= 0 ? args[artifactRootIdx + 1] : null;
const gitShaIdx = args.indexOf("--git-sha");
const gitShaOverride = gitShaIdx >= 0 ? args[gitShaIdx + 1] : null;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packagingRoot = join(scriptDir, "../..");
const root = artifactRootArg || packagingRoot;
const outRoot = join(packagingRoot, ".artifacts/prod8");
const gitCwd = packagingRoot;

function run(cmdArgs, opts = {}) {
  const r = spawnSync(cmdArgs[0], cmdArgs.slice(1), {
    cwd: opts.cwd || gitCwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    env: opts.env,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || `${cmdArgs.join(" ")} failed`);
  return (r.stdout || "").trim();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Dir(dir) {
  const h = createHash("sha256");
  const files = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const abs = join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) files.push(abs);
    }
  }
  walk(dir);
  for (const file of files) {
    const rel = relative(dir, file);
    h.update(rel);
    h.update("\0");
    h.update(readFileSync(file));
    h.update("\0");
  }
  return h.digest("hex");
}

const gitSha = gitShaOverride || run(["git", "rev-parse", "HEAD"]);
const resolvedSha = gitShaOverride
  ? gitShaOverride
  : run(["git", "rev-parse", "--verify", "HEAD^{commit}"]);
if (gitSha !== resolvedSha) {
  console.error(`prod8-build-immutable-bundle: FAIL — HEAD ${gitSha} != resolved commit ${resolvedSha}`);
  process.exit(1);
}

const status = artifactRootArg ? "" : run(["git", "status", "--porcelain"]);
const dirty = status.length > 0;

if (!artifactRootArg) {
  run([process.execPath, join(packagingRoot, "scripts/ops/prod8-artifact-preflight.mjs")]);
}

mkdirSync(outRoot, { recursive: true });
const sbomPath = join(outRoot, "app-tour.cdx.json");
run([
  process.execPath,
  join(packagingRoot, "scripts/ops/sbom-from-pnpm-lock.mjs"),
  "--out",
  sbomPath,
]);

const surfaces = [
  { id: "api", dist: "apps/api/dist", entry: "apps/api/dist/main.js" },
  { id: "web", dist: "apps/web/.next", entry: "apps/web/.next/BUILD_ID" },
  { id: "marketing", dist: "apps/marketing/.next", entry: "apps/marketing/.next/BUILD_ID" },
  { id: "portal", dist: "apps/portal/.next", entry: "apps/portal/.next/BUILD_ID" },
];

if (doBuild) {
  if (dirty) {
    console.error("prod8-build-immutable-bundle: FAIL — --build requires clean worktree");
    process.exit(1);
  }
  const buildEnv = { ...process.env, DEPLOY_PATH: root };
  const build = spawnSync("pnpm", ["run", "build:operator-vps"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    env: buildEnv,
  });
  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout || "pnpm run build:operator-vps failed");
  }
}

const artifacts = {};
let buildComplete = true;
for (const surface of surfaces) {
  const entryPath = join(root, surface.entry);
  const distPath = join(root, surface.dist);
  const present = existsSync(entryPath);
  if (!present) buildComplete = false;
  artifacts[surface.id] = {
    path: surface.dist,
    entry: surface.entry,
    present,
    sha256: present ? sha256File(entryPath) : null,
    tree_sha256: existsSync(distPath) ? sha256Dir(distPath) : null,
  };
}

const migrationsDir = join(root, "apps/api/prisma/migrations");
const migrationFolders = existsSync(migrationsDir)
  ? readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  : [];
const migrationManifest = migrationFolders.map((folder) => {
  const sql = join(migrationsDir, folder, "migration.sql");
  return {
    folder,
    sha256: existsSync(sql) ? sha256File(sql) : null,
  };
});

const workspaceManifests = [
  "packages/workspaces/denali/workspace.manifest.json",
  "packages/workspaces/urban/workspace.manifest.json",
  "packages/workspaces/harbor/workspace.manifest.json",
  "packages/workspaces/starter/workspace.manifest.json",
  "packages/workspaces/alpine/workspace.manifest.json",
];
const manifests = Object.fromEntries(
  workspaceManifests
    .filter((rel) => existsSync(join(root, rel)))
    .map((rel) => [rel, sha256File(join(root, rel))]),
);

const runtimeMetadata = {
  node_version: process.version,
  nvmrc: existsSync(join(root, ".nvmrc")) ? readFileSync(join(root, ".nvmrc"), "utf8").trim() : null,
  package_version: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version ?? "0.0.0",
};

const checksumInputs = [
  sha256File(join(root, "pnpm-lock.yaml")),
  sha256File(join(root, "package.json")),
  sha256File(sbomPath),
  ...Object.values(manifests),
  ...migrationManifest.map((m) => m.sha256).filter(Boolean),
  ...Object.values(artifacts)
    .map((a) => a.tree_sha256)
    .filter(Boolean),
];
const deploymentFingerprint = createHash("sha256").update(checksumInputs.join("\n")).digest("hex");

const buildManifest = {
  schema_version: "prod8-build-manifest.1",
  git_sha: gitSha,
  resolved_commit_sha: resolvedSha,
  generated_at: new Date().toISOString(),
  dirty_worktree: dirty,
  artifact_root: artifactRootArg || packagingRoot,
  build_complete: buildComplete,
  surfaces: artifacts,
  migrations: migrationManifest,
  workspace_manifests: manifests,
  runtime_metadata: runtimeMetadata,
  deployment_fingerprint: deploymentFingerprint,
};

const provenance = {
  schema_version: "prod8-provenance.2",
  git_sha: gitSha,
  resolved_commit_sha: resolvedSha,
  dirty_worktree: dirty,
  signed_attestation: false,
  signed_attestation_blocker: dirty
    ? "dirty worktree — do not attest as clean immutable RC"
    : buildComplete
      ? "external signing not configured in local session"
      : "build outputs incomplete — run package-immutable-release.sh on clean checkout",
  local_checksum_provenance: !dirty && buildComplete,
  same_digest_required: true,
  same_digest_staging_production_verified: "NOT_YET_VERIFIED",
  digest_policy:
    "staging and production must deploy the same deployment_fingerprint from one RC build",
};

const bundle = {
  schema_version: "prod8-immutable-bundle.1",
  tasks: ["R8-02", "R8-03", "R8-04", "R8-05", "R8-06"],
  git_sha: gitSha,
  generated_at: new Date().toISOString(),
  dirty_worktree: dirty,
  build_manifest: buildManifest,
  provenance,
  sbom: { path: ".artifacts/prod8/app-tour.cdx.json", sha256: sha256File(sbomPath) },
  checksums: {
    lockfile: sha256File(join(root, "pnpm-lock.yaml")),
    package_json: sha256File(join(root, "package.json")),
    deployment_fingerprint: deploymentFingerprint,
  },
  status:
    dirty || !buildComplete
      ? dirty
        ? "MACHINERY_VERIFIED_DIRTY_DEFERRED"
        : "MACHINERY_VERIFIED_BUILD_INCOMPLETE"
      : "READY_FOR_RC",
};

writeFileSync(join(outRoot, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`);
writeFileSync(join(outRoot, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
writeFileSync(join(outRoot, "immutable-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);

const bundleDir = join(outRoot, `bundle-${gitSha.slice(0, 12)}`);
if (buildComplete && !dirty) {
  mkdirSync(bundleDir, { recursive: true });
  for (const surface of surfaces) {
    const src = join(root, surface.dist);
    if (existsSync(src)) {
      cpSync(src, join(bundleDir, surface.id), { recursive: true });
    }
  }
  const metaDir = join(bundleDir, "metadata");
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(join(metaDir, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`);
  writeFileSync(join(metaDir, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
  writeFileSync(join(metaDir, "migrations-index.json"), `${JSON.stringify(migrationManifest, null, 2)}\n`);
  cpSync(sbomPath, join(metaDir, "app-tour.cdx.json"));

  if (artifactRootArg) {
    const stagingMeta = join(root, "deploy-metadata");
    mkdirSync(stagingMeta, { recursive: true });
    writeFileSync(join(stagingMeta, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`);
    writeFileSync(join(stagingMeta, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
    writeFileSync(join(stagingMeta, "immutable-bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`);
    cpSync(sbomPath, join(stagingMeta, "app-tour.cdx.json"));
  }
}

console.log(
  `prod8-build-immutable-bundle: ${bundle.status} — sha=${gitSha.slice(0, 8)} fingerprint=${deploymentFingerprint.slice(0, 12)} dirty=${dirty} build=${buildComplete}`,
);
process.exit(0);
