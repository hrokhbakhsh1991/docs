#!/usr/bin/env node
/**
 * Gap Closure D.3 / C.3b / C.3c — deploy-profile apply orchestrator (image builds).
 * Default: dry-run (print only). --write requires WORKSPACE_DEPLOY_PROFILE_APPLY=1.
 * @see docs/dev/saas-platform-remediation.mdoc
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { discoverManifests } from "./codegen/workspace-registry/manifest-loader.mjs";
import {
  assertDeployProfileBundlePlanCoherent,
  buildDeployProfileBundlePlan,
  formatDeployProfileAllowEnvExports,
  generateAdminThemeStylesheetLoader,
  generateAdminTranspilePackages,
  generateGuestThemeStylesheetLoader,
  generateGuestTranspilePackages,
  resolveWorkspaceDeployProfile,
  syncGuestWorkspaceRuntimePackageJsonForDeploy,
} from "./codegen/workspace-registry/domains/theme.mjs";
import {
  generatePortalRegisterOutputs,
  portalRegisterOutputKey,
  selectPortalRegisterManifests,
} from "./codegen/workspace-registry/domains/registration.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEPLOY_PROFILE_TRANSPILE_OUTPUTS = Object.freeze({
  portal: join(REPO_ROOT, "apps/portal/src/bootstrap/guest-transpile-packages.generated.mjs"),
  marketing: join(
    REPO_ROOT,
    "apps/marketing/src/bootstrap/guest-transpile-packages.generated.mjs"
  ),
  admin: join(REPO_ROOT, "apps/web/src/bootstrap/admin-transpile-packages.generated.mjs"),
});

/** Gap Closure C.3b — theme loader artifacts rewritten on --write. */
export const DEPLOY_PROFILE_THEME_OUTPUTS = Object.freeze({
  adminTheme: join(REPO_ROOT, "apps/web/src/bootstrap/workspace-theme-stylesheets.generated.ts"),
  portalTheme: join(
    REPO_ROOT,
    "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.portal.generated.ts"
  ),
  marketingTheme: join(
    REPO_ROOT,
    "packages/guest-workspace-runtime/src/workspace-guest-theme-stylesheets.marketing.generated.ts"
  ),
});

/**
 * Gap Closure C.3c — portal/host register paths (membership-dependent).
 * @param {import("./codegen/workspace-registry/manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {string} [repoRoot]
 * @returns {Record<string, string>}
 */
export function resolveDeployProfileRegisterPaths(manifests, repoRoot = REPO_ROOT) {
  /** @type {Record<string, string>} */
  const paths = {
    portalRegisterManifest: join(
      repoRoot,
      "packages/guest-workspace-runtime/src/workspace-plugin-register-manifest.generated.ts"
    ),
    hostRegisterManifest: join(
      repoRoot,
      "packages/workspace-plugin-host/src/workspace-plugin-register-manifest.generated.ts"
    ),
  };
  for (const m of selectPortalRegisterManifests(manifests)) {
    paths[portalRegisterOutputKey(m.id)] = join(
      repoRoot,
      `packages/guest-workspace-runtime/src/register-${m.id}.generated.ts`
    );
  }
  return paths;
}

/**
 * @param {{
 *   readonly manifests: import("./codegen/workspace-registry/manifest-loader.mjs").WorkspaceManifest[];
 *   readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
 *   readonly write?: boolean;
 *   readonly outputs?: typeof DEPLOY_PROFILE_TRANSPILE_OUTPUTS;
 *   readonly themeOutputs?: typeof DEPLOY_PROFILE_THEME_OUTPUTS;
 *   readonly registerPaths?: Record<string, string>;
 *   readonly syncGuestRuntime?: typeof syncGuestWorkspaceRuntimePackageJsonForDeploy;
 *   readonly writeFile?: typeof writeFileSync;
 * }} input
 */
export function applyDeployProfile(input) {
  const env = input.env ?? process.env;
  const write = input.write === true;
  const outputs = input.outputs ?? DEPLOY_PROFILE_TRANSPILE_OUTPUTS;
  const themeOutputs = input.themeOutputs ?? DEPLOY_PROFILE_THEME_OUTPUTS;
  const registerPaths =
    input.registerPaths ?? resolveDeployProfileRegisterPaths(input.manifests);
  const syncGuestRuntime = input.syncGuestRuntime ?? syncGuestWorkspaceRuntimePackageJsonForDeploy;
  const writeFile = input.writeFile ?? writeFileSync;

  const resolved = resolveWorkspaceDeployProfile(env);
  if (write && !resolved.applied) {
    throw new Error(
      "apply:deploy-profile --write requires WORKSPACE_DEPLOY_PROFILE_APPLY=1 (triple opt-in)"
    );
  }

  const plan = buildDeployProfileBundlePlan(input.manifests, env);
  const coherence = assertDeployProfileBundlePlanCoherent(plan);
  if (!coherence.ok) {
    throw new Error(
      `apply:deploy-profile plan incoherent:\n${coherence.errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }

  const portalSrc = generateGuestTranspilePackages(input.manifests, "portal", env);
  const marketingSrc = generateGuestTranspilePackages(input.manifests, "marketing", env);
  const adminSrc = generateAdminTranspilePackages(input.manifests, env);
  const adminThemeSrc = generateAdminThemeStylesheetLoader(input.manifests, env);
  const portalThemeSrc = generateGuestThemeStylesheetLoader(input.manifests, "portal", env);
  const marketingThemeSrc = generateGuestThemeStylesheetLoader(input.manifests, "marketing", env);
  const registerOutputs = generatePortalRegisterOutputs(input.manifests, env);
  const allowExports = formatDeployProfileAllowEnvExports(plan);

  /** @type {{ readonly path: string; readonly bytes: number }[]} */
  const written = [];
  /** @type {{ readonly written: boolean; readonly products: readonly string[]; readonly profile: string } | null} */
  let guestRuntime = null;

  if (write) {
    writeFile(outputs.portal, portalSrc);
    written.push({ path: outputs.portal, bytes: Buffer.byteLength(portalSrc) });
    writeFile(outputs.marketing, marketingSrc);
    written.push({ path: outputs.marketing, bytes: Buffer.byteLength(marketingSrc) });
    writeFile(outputs.admin, adminSrc);
    written.push({ path: outputs.admin, bytes: Buffer.byteLength(adminSrc) });
    writeFile(themeOutputs.adminTheme, adminThemeSrc);
    written.push({ path: themeOutputs.adminTheme, bytes: Buffer.byteLength(adminThemeSrc) });
    writeFile(themeOutputs.portalTheme, portalThemeSrc);
    written.push({ path: themeOutputs.portalTheme, bytes: Buffer.byteLength(portalThemeSrc) });
    writeFile(themeOutputs.marketingTheme, marketingThemeSrc);
    written.push({
      path: themeOutputs.marketingTheme,
      bytes: Buffer.byteLength(marketingThemeSrc),
    });
    for (const [key, src] of Object.entries(registerOutputs)) {
      const path = registerPaths[key];
      if (typeof path !== "string") {
        throw new Error(`apply:deploy-profile missing register path for key ${key}`);
      }
      writeFile(path, src);
      written.push({ path, bytes: Buffer.byteLength(src) });
    }
    guestRuntime = syncGuestRuntime(input.manifests, env);
  }

  return {
    mode: write ? "write" : "dry-run",
    applied: plan.applied,
    profile: plan.profile,
    adminTranspileProducts: plan.adminTranspileProducts,
    guestRuntimeProducts: plan.guestRuntimeProducts,
    recommendedProcessEnv: plan.recommendedProcessEnv,
    allowExports,
    written,
    guestRuntime,
    portalSrc,
    marketingSrc,
    adminSrc,
    adminThemeSrc,
    portalThemeSrc,
    marketingThemeSrc,
    registerOutputs,
  };
}

function main(argv) {
  const args = argv.filter((a) => a !== "--");
  const write = args.includes("--write");
  const unknown = args.filter((a) => a.startsWith("-") && a !== "--write");
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(", ")}`);
    console.error("Usage: pnpm run apply:deploy-profile [--write]");
    process.exit(1);
  }

  try {
    const result = applyDeployProfile({
      manifests: discoverManifests(),
      env: process.env,
      write,
    });
    console.log(
      `apply:deploy-profile: ${result.mode} applied=${result.applied} profile=${JSON.stringify(result.profile)}`
    );
    console.log(`  admin products (${result.adminTranspileProducts.length}):`);
    for (const pkg of result.adminTranspileProducts) console.log(`    ${pkg}`);
    if (result.mode === "write") {
      console.log("  written:");
      for (const row of result.written) console.log(`    ${row.path} (${row.bytes} bytes)`);
      if (result.guestRuntime) {
        console.log(
          `  guest-runtime: ${result.guestRuntime.written ? "WRITTEN" : "unchanged"} products=${result.guestRuntime.products.length}`
        );
      }
      console.log(
        "  NOTE: do not commit filtered transpile/theme/register lists / guest-runtime package.json"
      );
      console.log("  Restore trunk: pnpm run generate:workspace-registry");
    } else {
      console.log("  dry-run: no files written (pass --write for image builds)");
    }
    process.stdout.write(result.allowExports);
  } catch (err) {
    console.error(`apply:deploy-profile: FAIL — ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
