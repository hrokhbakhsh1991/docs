#!/usr/bin/env node
/**
 * PF-3.1 / G3.4 — generated workspace imports must resolve via consumer package.json deps.
 * @see docs/phase-10/subphases/10.7-enforcement-dx.md
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { PORTAL_REGISTER_GENERATED_RELS } = require(
  "../codegen/workspace-registry/generated/manifest-boundary-allowlist.generated.cjs"
);

/** @type {{ label: string; pkgJson: string; generated: string[] }[]} */
const CONSUMERS = [
  {
    label: "workspace-plugin-host",
    pkgJson: "packages/workspace-plugin-host/package.json",
    generated: [
      "packages/workspace-plugin-host/src/workspace-plugin-register-manifest.generated.ts",
    ],
  },
  {
    label: "apps/api",
    pkgJson: "apps/api/package.json",
    generated: [
      "apps/api/src/workspace/workspace-plugin-registry.generated.ts",
      "apps/api/src/http/workspace-http-routes.generated.ts",
      "apps/api/src/settings/workspace-dev-bootstrap-bindings.generated.ts",
    ],
  },
  {
    label: "apps/web",
    pkgJson: "apps/web/package.json",
    generated: [
      "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts",
      "apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts",
    ],
  },
  {
    label: "guest-workspace-runtime",
    pkgJson: "packages/guest-workspace-runtime/package.json",
    generated: [
      ...PORTAL_REGISTER_GENERATED_RELS,
      "packages/guest-workspace-runtime/src/workspace-plugin-register-manifest.generated.ts",
      "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.portal.generated.ts",
      "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.marketing.generated.ts",
      "packages/guest-workspace-runtime/src/workspace-marketing-catalog-bindings.generated.ts",
    ],
  },
];

/** @param {string} rel */
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

/** @param {string} pkgJsonRel */
function readDeclaredDeps(pkgJsonRel) {
  const json = JSON.parse(read(pkgJsonRel));
  return new Set([
    ...Object.keys(json.dependencies ?? {}),
    ...Object.keys(json.devDependencies ?? {}),
    ...Object.keys(json.peerDependencies ?? {}),
  ]);
}

/** @param {string} source */
function extractWorkspacePackages(source) {
  return [
    ...new Set([...source.matchAll(/@app-tour\/workspace-[a-z0-9-]+/g)].map((match) => match[0])),
  ];
}

/** @type {string[]} */
const violations = [];

for (const consumer of CONSUMERS) {
  const deps = readDeclaredDeps(consumer.pkgJson);
  const selfName = JSON.parse(read(consumer.pkgJson)).name;
  /** @type {Set<string>} */
  const required = new Set();

  for (const generatedRel of consumer.generated) {
    const abs = path.join(REPO_ROOT, generatedRel);
    if (!fs.existsSync(abs)) {
      violations.push(`${consumer.label}: missing generated file ${generatedRel}`);
      continue;
    }
    for (const pkg of extractWorkspacePackages(read(generatedRel))) {
      if (pkg === selfName) {
        continue; // self-imports via package exports (e.g. register manifest → ./register-denali)
      }
      required.add(pkg);
    }
  }

  for (const pkg of required) {
    if (!deps.has(pkg)) {
      violations.push(`${consumer.label}: ${consumer.pkgJson} missing dependency ${pkg}`);
    }
  }
}

const apiPkg = JSON.parse(read("apps/api/package.json"));
const prebuild = typeof apiPkg.scripts?.prebuild === "string" ? apiPkg.scripts.prebuild : "";
const delegatedWorkspaceBuild = "scripts/ci/build-api-workspace-deps.sh";
const delegatesAllWorkspaceBuilds = prebuild.includes(delegatedWorkspaceBuild);
if (delegatesAllWorkspaceBuilds) {
  const delegatedSource = read(delegatedWorkspaceBuild);
  if (
    !/for dir in packages\/workspaces\/\*\//.test(delegatedSource) ||
    !/pnpm --dir "\$dir" run build/.test(delegatedSource)
  ) {
    violations.push(
      `apps/api: ${delegatedWorkspaceBuild} must build every workspace package with pnpm --dir`,
    );
  }
} else {
  for (const pkg of extractWorkspacePackages(read("apps/api/src/http/workspace-http-routes.generated.ts"))) {
    const filter = `--filter ${pkg}...`;
    if (!prebuild.includes(filter)) {
      violations.push(`apps/api: prebuild must include ${filter} (HTTP route manifest import ${pkg})`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-guest-consumer-deps: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-guest-consumer-deps: PASS");
