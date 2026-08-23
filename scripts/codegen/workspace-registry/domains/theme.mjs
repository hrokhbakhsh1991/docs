import { BANNER, REPO_ROOT } from "../constants.mjs";
import { selectPortalRegisterManifests } from "./registration.mjs";
import { productWorkspaceManifests } from "./core-registry.mjs";
import {
  applyDeployProfileToProductPackages,
  filterManifestsByDeployProfile,
  filterProductPackagesByDeployProfile,
  isGuestRuntimeProductWorkspaceDep,
  resolveWorkspaceDeployProfile,
} from "./deploy-profile.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export {
  applyDeployProfileToProductPackages,
  filterManifestsByDeployProfile,
  filterProductPackagesByDeployProfile,
  isGuestRuntimeProductWorkspaceDep,
  resolveWorkspaceDeployProfile,
} from "./deploy-profile.mjs";

/** Fixed Next transpilePackages for portal (non-workspace product packages). */
export const PORTAL_PLATFORM_TRANSPILE_PACKAGES = Object.freeze([
  "@app-tour/design-tokens",
  "@app-tour/theme-react",
  "@app-tour/ui-primitives",
  "@app-tour/workspace-sdk",
  "@app-tour/workspace-plugin-host",
  "@app-tour/guest-workspace-runtime",
  "@app-tour/catalog-intake-ui",
  "@app-tour/catalog-registration-auth",
  "@app-tour/catalog-registration-flow-ui",
]);

/** Fixed Next transpilePackages for marketing (non-workspace product packages). */
export const MARKETING_PLATFORM_TRANSPILE_PACKAGES = Object.freeze([
  "@app-tour/design-tokens",
  "@app-tour/theme-react",
  "@app-tour/ui-primitives",
  "@app-tour/workspace-sdk",
  "@app-tour/guest-workspace-runtime",
  "@app-tour/catalog-registration-auth",
  "@app-tour/catalog-registration-flow-ui",
]);

/** Fixed Next transpilePackages for admin web (non-workspace product packages). */
export const ADMIN_PLATFORM_TRANSPILE_PACKAGES = Object.freeze([
  "@app-tour/draft-engine",
  "@app-tour/wizard-navigation",
  "@app-tour/design-tokens",
  "@app-tour/platform-core",
  "@app-tour/theme-react",
  "@app-tour/ui-primitives",
  "@app-tour/workspace-sdk",
  /** PR8-B Case Encounter UI — must be transpiled so Next resolves workspace client imports. */
  "@app-tour/finance-case-encounter-ui",
]);

/**
 * Manifest-level client bundle policy. Registry/proof workspaces may remain in
 * manifest codegen while opting out of the default committed frontend bundle.
 * Deploy-profile APPLY remains authoritative for image-specific bundles.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest} manifest
 * @returns {boolean}
 */
export function isDefaultClientBundleManifest(manifest) {
  const cfg = manifest.clientBundle;
  if (cfg === undefined) {
    return true;
  }
  if (typeof cfg !== "object" || cfg === null || Array.isArray(cfg)) {
    throw new Error(`${manifest.id}: clientBundle must be an object`);
  }
  const include = cfg.includeInDefault;
  if (include !== undefined && typeof include !== "boolean") {
    throw new Error(`${manifest.id}: clientBundle.includeInDefault must be boolean`);
  }
  return include !== false;
}

/**
 * Default client bundles exclude manifest-declared proof fixtures that opt out.
 * With WORKSPACE_DEPLOY_PROFILE_APPLY=1, profile membership is explicit and may
 * select any manifest package for image-only generated artifacts.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function filterClientBundleManifests(manifests, env = process.env) {
  const resolved = resolveWorkspaceDeployProfile(env);
  if (resolved.applied) {
    return filterManifestsByDeployProfile(manifests, env);
  }
  return manifests.filter((manifest) => isDefaultClientBundleManifest(manifest));
}

/**
 * Product workspace packages that guest Next apps must transpile (Wave C.b).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {"portal" | "marketing"} surface
 * @returns {string[]}
 */
export function collectGuestProductTranspilePackages(manifests, surface, env = process.env) {
  if (surface !== "portal" && surface !== "marketing") {
    throw new Error(`collectGuestProductTranspilePackages: unknown surface ${surface}`);
  }
  /** @type {Set<string>} */
  const packages = new Set();
  const scoped = filterClientBundleManifests(manifests, env);
  const starter = scoped.find((m) => m.id === "starter");
  if (starter?.package) {
    packages.add(starter.package);
  }

  for (const m of scoped) {
    if (m.workspaceFinance?.registryOnly === true || m.workspaceBooking?.registryOnly === true) {
      continue;
    }
    if (typeof m.package !== "string" || m.package.length === 0) {
      continue;
    }
    const guest = m.guestThemeStylesheets;
    if (guest != null && typeof guest === "object" && !Array.isArray(guest)) {
      const sheets = guest[surface];
      if (Array.isArray(sheets) && sheets.length > 0) {
        packages.add(m.package);
      }
    }
    if (surface === "marketing" && m.marketingCatalog !== undefined) {
      packages.add(m.package);
    }
  }

  if (surface === "portal") {
    for (const m of selectPortalRegisterManifests(scoped)) {
      if (typeof m.package === "string" && m.package.length > 0) {
        packages.add(m.package);
      }
    }
  }

  return [...packages].sort((a, b) => a.localeCompare(b));
}

/**
 * Product workspace packages that admin Next must transpile (Wave G.a).
 * Membership mirrors admin theme registry: starter + themeStylesheets declarants.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {string[]}
 */
export function collectAdminProductTranspilePackages(manifests, env = process.env) {
  /** @type {Set<string>} */
  const packages = new Set();
  const scoped = filterClientBundleManifests(manifests, env);
  const starter = scoped.find((m) => m.id === "starter");
  if (starter?.package) {
    packages.add(starter.package);
  }

  for (const m of scoped) {
    if (m.workspaceFinance?.registryOnly === true || m.workspaceBooking?.registryOnly === true) {
      continue;
    }
    if (typeof m.package !== "string" || m.package.length === 0) {
      continue;
    }
    const sheets = Array.isArray(m.themeStylesheets) ? m.themeStylesheets : [];
    if (sheets.length > 0) {
      packages.add(m.package);
    }
  }

  return [...packages].sort((a, b) => a.localeCompare(b));
}

/**
 * Union of portal + marketing guest product packages for guest-workspace-runtime deps (Wave C.c).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {string[]}
 */
export function collectGuestRuntimeProductPackages(manifests) {
  /** @type {Set<string>} */
  const packages = new Set([
    ...collectGuestProductTranspilePackages(manifests, "portal"),
    ...collectGuestProductTranspilePackages(manifests, "marketing"),
  ]);
  return [...packages].sort((a, b) => a.localeCompare(b));
}

/**
 * Gap Closure C.2c — guest-runtime product packages after optional deploy-profile filter.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function collectGuestRuntimeProductPackagesForEnv(manifests, env = process.env) {
  const collected = [
    ...new Set([
      ...collectGuestProductTranspilePackages(manifests, "portal", env),
      ...collectGuestProductTranspilePackages(manifests, "marketing", env),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  return applyDeployProfileToProductPackages(collected, env).packages;
}

/**
 * @param {Record<string, string>} dependencies
 * @param {readonly string[]} productPackages
 * @returns {Record<string, string>}
 */
export function buildGuestRuntimeDependencies(dependencies, productPackages) {
  /** @type {Record<string, string>} */
  const next = {};
  for (const [name, version] of Object.entries(dependencies ?? {})) {
    if (!isGuestRuntimeProductWorkspaceDep(name)) {
      next[name] = version;
    }
  }
  for (const pkg of productPackages) {
    next[pkg] = "workspace:*";
  }
  return Object.fromEntries(
    Object.keys(next)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, next[k]])
  );
}

/**
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {{ ok: true } | { ok: false; expected: Record<string, string>; actual: Record<string, string> }}
 */
export function verifyGuestWorkspaceRuntimePackageJson(manifests) {
  const pkgPath = join(REPO_ROOT, "packages/guest-workspace-runtime/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const actual = pkg.dependencies ?? {};
  const expected = buildGuestRuntimeDependencies(
    actual,
    collectGuestRuntimeProductPackages(manifests)
  );
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    return { ok: false, expected, actual };
  }
  return { ok: true };
}

/**
 * Rewrite product workspace deps on guest-workspace-runtime to match manifests (Wave C.c).
 * Always full-trunk — deploy profile filtering uses {@link syncGuestWorkspaceRuntimePackageJsonForDeploy}.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {boolean} true when package.json was written
 */
export function syncGuestWorkspaceRuntimePackageJson(manifests) {
  const pkgPath = join(REPO_ROOT, "packages/guest-workspace-runtime/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const expected = buildGuestRuntimeDependencies(
    pkg.dependencies ?? {},
    collectGuestRuntimeProductPackages(manifests)
  );
  if (JSON.stringify(pkg.dependencies ?? {}) === JSON.stringify(expected)) {
    return false;
  }
  pkg.dependencies = expected;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return true;
}

/**
 * Gap Closure C.2c — deploy-image-only guest-runtime product dep sync (double opt-in required).
 * Refuses to run unless WORKSPACE_DEPLOY_PROFILE_APPLY=1. Do not use on trunk checkouts intended for commit.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{ readonly written: boolean; readonly products: readonly string[]; readonly profile: string }}
 */
export function syncGuestWorkspaceRuntimePackageJsonForDeploy(manifests, env = process.env) {
  const resolved = resolveWorkspaceDeployProfile(env);
  if (!resolved.applied) {
    throw new Error(
      "syncGuestWorkspaceRuntimePackageJsonForDeploy requires WORKSPACE_DEPLOY_PROFILE_APPLY=1"
    );
  }
  const products = collectGuestRuntimeProductPackagesForEnv(manifests, env);
  const pkgPath = join(REPO_ROOT, "packages/guest-workspace-runtime/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const expected = buildGuestRuntimeDependencies(pkg.dependencies ?? {}, products);
  const written = JSON.stringify(pkg.dependencies ?? {}) !== JSON.stringify(expected);
  if (written) {
    pkg.dependencies = expected;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }
  return { written, products, profile: resolved.profile };
}

/**
 * Product trunk packages the admin web host must declare (Wave I.8).
 * Same set as plugin loaders / boundary PRODUCT_WORKSPACE_PACKAGES.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {string[]}
 */
export function collectAdminHostProductPackages(manifests) {
  return productWorkspaceManifests(manifests)
    .map((m) => m.package)
    .filter((pkg) => typeof pkg === "string" && pkg.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} name
 */
export function isAdminHostProductWorkspaceDep(name) {
  if (name === "@app-tour/workspace-sdk" || name === "@app-tour/workspace-plugin-host") {
    return false;
  }
  return name.startsWith("@app-tour/workspace-");
}

/**
 * Strip product workspace keys from a dependency map (Wave I.8).
 * @param {Record<string, string>} block
 * @returns {Record<string, string>}
 */
export function stripAdminHostProductWorkspaceDeps(block) {
  /** @type {Record<string, string>} */
  const next = {};
  for (const [name, version] of Object.entries(block ?? {})) {
    if (!isAdminHostProductWorkspaceDep(name)) {
      next[name] = version;
    }
  }
  return Object.fromEntries(
    Object.keys(next)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, next[k]])
  );
}

/**
 * Rebuild apps/web devDependencies product keys from manifests (Wave I.8).
 * @param {Record<string, string>} devDependencies
 * @param {readonly string[]} productPackages
 * @returns {Record<string, string>}
 */
export function buildAdminWebDevDependencies(devDependencies, productPackages) {
  /** @type {Record<string, string>} */
  const next = {};
  for (const [name, version] of Object.entries(devDependencies ?? {})) {
    if (!isAdminHostProductWorkspaceDep(name)) {
      next[name] = version;
    }
  }
  for (const pkg of productPackages) {
    next[pkg] = "workspace:*";
  }
  return Object.fromEntries(
    Object.keys(next)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, next[k]])
  );
}

/**
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {{
 *   ok: true
 * } | {
 *   ok: false;
 *   expectedDependencies: Record<string, string>;
 *   actualDependencies: Record<string, string>;
 *   expectedDevDependencies: Record<string, string>;
 *   actualDevDependencies: Record<string, string>;
 * }}
 */
export function verifyAdminWebPackageJson(manifests) {
  const pkgPath = join(REPO_ROOT, "apps/web/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const products = collectAdminHostProductPackages(manifests);
  const expectedDependencies = stripAdminHostProductWorkspaceDeps(pkg.dependencies ?? {});
  const expectedDevDependencies = buildAdminWebDevDependencies(pkg.devDependencies ?? {}, products);
  const actualDependencies = pkg.dependencies ?? {};
  const actualDevDependencies = pkg.devDependencies ?? {};
  if (
    JSON.stringify(actualDependencies) !== JSON.stringify(expectedDependencies) ||
    JSON.stringify(actualDevDependencies) !== JSON.stringify(expectedDevDependencies)
  ) {
    return {
      ok: false,
      expectedDependencies,
      actualDependencies,
      expectedDevDependencies,
      actualDevDependencies,
    };
  }
  return { ok: true };
}

/**
 * Rewrite apps/web product workspace deps to match product trunk (Wave I.8).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {boolean} true when package.json was written
 */
export function syncAdminWebPackageJson(manifests) {
  const pkgPath = join(REPO_ROOT, "apps/web/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const products = collectAdminHostProductPackages(manifests);
  const expectedDependencies = stripAdminHostProductWorkspaceDeps(pkg.dependencies ?? {});
  const expectedDevDependencies = buildAdminWebDevDependencies(pkg.devDependencies ?? {}, products);
  if (
    JSON.stringify(pkg.dependencies ?? {}) === JSON.stringify(expectedDependencies) &&
    JSON.stringify(pkg.devDependencies ?? {}) === JSON.stringify(expectedDevDependencies)
  ) {
    return false;
  }
  pkg.dependencies = expectedDependencies;
  pkg.devDependencies = expectedDevDependencies;
  if (pkg.optionalDependencies && typeof pkg.optionalDependencies === "object") {
    pkg.optionalDependencies = stripAdminHostProductWorkspaceDeps(pkg.optionalDependencies);
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return true;
}

/**
 * True when the manifest is a finance/booking registry-only certification fixture
 * (skipped by admin-web product trunk; **retained** on API — PSR-4b-api-deps-fixture-split).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest} manifest
 */
export function isApiHostRegistryOnlyFixtureManifest(manifest) {
  return (
    manifest.workspaceFinance?.registryOnly === true ||
    manifest.workspaceBooking?.registryOnly === true
  );
}

/**
 * All manifest `package` names the API host must declare (PSR-4b-api-deps-sync).
 * Includes registryOnly finance/booking fixtures (unlike admin web product trunk).
 * Decision: fixtures stay — see PSR-4b-api-deps-fixture-split.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {string[]}
 */
export function collectApiHostManifestPackages(manifests) {
  /** @type {Set<string>} */
  const packages = new Set();
  for (const m of manifests) {
    if (typeof m.package === "string" && m.package.length > 0) {
      packages.add(m.package);
    }
  }
  return [...packages].sort((a, b) => a.localeCompare(b));
}

/**
 * Partition API host packages into registryOnly fixtures vs everything else.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {{
 *   all: string[];
 *   registryOnlyFixtures: string[];
 *   nonRegistryOnly: string[];
 * }}
 */
export function partitionApiHostManifestPackages(manifests) {
  /** @type {Set<string>} */
  const fixtures = new Set();
  /** @type {Set<string>} */
  const nonFixtures = new Set();
  for (const m of manifests) {
    if (typeof m.package !== "string" || m.package.length === 0) continue;
    if (isApiHostRegistryOnlyFixtureManifest(m)) {
      fixtures.add(m.package);
    } else {
      nonFixtures.add(m.package);
    }
  }
  const sort = (a, b) => a.localeCompare(b);
  return {
    all: collectApiHostManifestPackages(manifests),
    registryOnlyFixtures: [...fixtures].sort(sort),
    nonRegistryOnly: [...nonFixtures].sort(sort),
  };
}

/**
 * @param {string} name
 */
export function isApiHostProductWorkspaceDep(name) {
  if (name === "@app-tour/workspace-sdk" || name === "@app-tour/workspace-plugin-host") {
    return false;
  }
  return name.startsWith("@app-tour/workspace-");
}

/**
 * Strip API product workspace keys (keeps workspace-sdk).
 * @param {Record<string, string>} block
 * @returns {Record<string, string>}
 */
export function stripApiHostProductWorkspaceDeps(block) {
  /** @type {Record<string, string>} */
  const next = {};
  for (const [name, version] of Object.entries(block ?? {})) {
    if (!isApiHostProductWorkspaceDep(name)) {
      next[name] = version;
    }
  }
  return Object.fromEntries(
    Object.keys(next)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, next[k]])
  );
}

/**
 * Rebuild apps/api dependencies product keys from all manifests (PSR-4b-api-deps-sync).
 * @param {Record<string, string>} dependencies
 * @param {readonly string[]} manifestPackages
 * @returns {Record<string, string>}
 */
export function buildApiDependencies(dependencies, manifestPackages) {
  /** @type {Record<string, string>} */
  const next = {};
  for (const [name, version] of Object.entries(dependencies ?? {})) {
    if (!isApiHostProductWorkspaceDep(name)) {
      next[name] = version;
    }
  }
  for (const pkg of manifestPackages) {
    next[pkg] = "workspace:*";
  }
  return Object.fromEntries(
    Object.keys(next)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, next[k]])
  );
}

/**
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {{
 *   ok: true
 * } | {
 *   ok: false;
 *   expectedDependencies: Record<string, string>;
 *   actualDependencies: Record<string, string>;
 * }}
 */
export function verifyApiPackageJson(manifests) {
  const pkgPath = join(REPO_ROOT, "apps/api/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const products = collectApiHostManifestPackages(manifests);
  const expectedDependencies = buildApiDependencies(pkg.dependencies ?? {}, products);
  const actualDependencies = pkg.dependencies ?? {};
  if (JSON.stringify(actualDependencies) !== JSON.stringify(expectedDependencies)) {
    return {
      ok: false,
      expectedDependencies,
      actualDependencies,
    };
  }
  return { ok: true };
}

/**
 * Rewrite apps/api workspace product deps to match all manifests (PSR-4b-api-deps-sync).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {boolean} true when package.json was written
 */
export function syncApiPackageJson(manifests) {
  const pkgPath = join(REPO_ROOT, "apps/api/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const products = collectApiHostManifestPackages(manifests);
  const expectedDependencies = buildApiDependencies(pkg.dependencies ?? {}, products);
  const expectedDevDependencies = stripApiHostProductWorkspaceDeps(pkg.devDependencies ?? {});
  const expectedOptional =
    pkg.optionalDependencies && typeof pkg.optionalDependencies === "object"
      ? stripApiHostProductWorkspaceDeps(pkg.optionalDependencies)
      : undefined;
  const depsSame = JSON.stringify(pkg.dependencies ?? {}) === JSON.stringify(expectedDependencies);
  const devSame =
    JSON.stringify(pkg.devDependencies ?? {}) === JSON.stringify(expectedDevDependencies);
  const optSame =
    expectedOptional === undefined
      ? true
      : JSON.stringify(pkg.optionalDependencies ?? {}) === JSON.stringify(expectedOptional);
  if (depsSame && devSame && optSame) {
    return false;
  }
  pkg.dependencies = expectedDependencies;
  pkg.devDependencies = expectedDevDependencies;
  if (expectedOptional !== undefined) {
    pkg.optionalDependencies = expectedOptional;
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return true;
}

/**
 * ESM module for apps/{portal|marketing} next.config transpilePackages (Wave C.b).
 * Gap Closure C.2b — optional deploy-profile filter (double opt-in via env).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {"portal" | "marketing"} surface
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function generateGuestTranspilePackages(manifests, surface, env = process.env) {
  const platform =
    surface === "portal"
      ? PORTAL_PLATFORM_TRANSPILE_PACKAGES
      : MARKETING_PLATFORM_TRANSPILE_PACKAGES;
  const collected = collectGuestProductTranspilePackages(manifests, surface, env);
  const { packages: products, profileNote } = applyDeployProfileToProductPackages(collected, env);
  const merged = [...platform, ...products.filter((pkg) => !platform.includes(pkg))];
  const profileLine = profileNote != null ? `\n * ${profileNote}` : "";

  return `${BANNER}/** Wave C.b — portal/marketing Next transpilePackages from workspace manifests.${profileLine} */

/** @type {readonly string[]} */
export const GUEST_TRANSPILE_PACKAGES = Object.freeze([
${merged.map((pkg) => `  ${JSON.stringify(pkg)},`).join("\n")}
]);
`;
}

/**
 * ESM module for apps/web next.config transpilePackages (Wave G.a).
 * Gap Closure C.2b — optional deploy-profile filter (double opt-in via env).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function generateAdminTranspilePackages(manifests, env = process.env) {
  const collected = collectAdminProductTranspilePackages(manifests, env);
  const { packages: products, profileNote } = applyDeployProfileToProductPackages(collected, env);
  const merged = [
    ...ADMIN_PLATFORM_TRANSPILE_PACKAGES,
    ...products.filter((pkg) => !ADMIN_PLATFORM_TRANSPILE_PACKAGES.includes(pkg)),
  ];
  const profileLine = profileNote != null ? `\n * ${profileNote}` : "";

  return `${BANNER}/** Wave G.a — admin Next transpilePackages from workspace manifests.${profileLine} */

/** @type {readonly string[]} */
export const ADMIN_TRANSPILE_PACKAGES = Object.freeze([
${merged.map((pkg) => `  ${JSON.stringify(pkg)},`).join("\n")}
]);
`;
}

/**
 * Escape a package name for use inside a RegExp source (Wave H.j).
 * @param {string} packageName
 */
function escapePackageNameForRegExpSource(packageName) {
  return packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wave H.j — validate optional adminWeb.clientBundleEnvGate.
 * @param {{ id: string; package?: unknown; adminWeb?: unknown }} manifest
 */
export function assertAdminWebManifest(manifest) {
  if (manifest.adminWeb === undefined) {
    return;
  }
  const adminWeb = manifest.adminWeb;
  if (typeof adminWeb !== "object" || adminWeb === null || Array.isArray(adminWeb)) {
    throw new Error(`${manifest.id}: adminWeb must be an object`);
  }
  const gate = /** @type {{ clientBundleEnvGate?: unknown }} */ (adminWeb).clientBundleEnvGate;
  if (gate === undefined) {
    return;
  }
  if (typeof gate !== "string" || !/^ALLOW_[A-Z0-9_]+$/.test(gate)) {
    throw new Error(`${manifest.id}: adminWeb.clientBundleEnvGate must match /^ALLOW_[A-Z0-9_]+$/`);
  }
  if (typeof manifest.package !== "string" || manifest.package.trim().length === 0) {
    throw new Error(`${manifest.id}: adminWeb.clientBundleEnvGate requires package string`);
  }
}

/**
 * Wave H.j / Gap Closure D.1 — IgnorePlugin gate rows from manifests.
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @returns {{ id: string; packageName: string; envKey: string }[]}
 */
export function collectAdminClientWorkspaceIgnoreRows(manifests) {
  /** @type {{ id: string; packageName: string; envKey: string }[]} */
  const rows = [];
  for (const manifest of manifests) {
    assertAdminWebManifest(manifest);
    const gate = manifest.adminWeb?.clientBundleEnvGate;
    if (typeof gate !== "string") {
      continue;
    }
    rows.push({
      id: manifest.id,
      packageName: /** @type {string} */ (manifest.package),
      envKey: gate,
    });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return rows;
}

/**
 * Gap Closure D.1 — deploy-profile bundle plan (transpile products ∩ IgnorePlugin gates).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function buildDeployProfileBundlePlan(manifests, env = process.env) {
  const resolved = resolveWorkspaceDeployProfile(env);
  const adminTranspileProducts = applyDeployProfileToProductPackages(
    collectAdminProductTranspilePackages(manifests, env),
    env
  ).packages;
  const guestRuntimeProducts = collectGuestRuntimeProductPackagesForEnv(manifests, env);
  const ignoreRows = collectAdminClientWorkspaceIgnoreRows(manifests);
  const adminSet = new Set(adminTranspileProducts);
  const clientIgnore = ignoreRows.map((row) => {
    const inProfile = adminSet.has(row.packageName);
    return {
      id: row.id,
      packageName: row.packageName,
      envKey: row.envKey,
      inProfile,
      recommendedAllowEnv: inProfile ? "true" : null,
    };
  });
  /** @type {Record<string, string>} */
  const recommendedProcessEnv = {};
  for (const row of clientIgnore) {
    if (row.recommendedAllowEnv === "true") {
      recommendedProcessEnv[row.envKey] = "true";
    }
  }
  return {
    applied: resolved.applied,
    profile: resolved.profile,
    adminTranspileProducts,
    guestRuntimeProducts,
    clientIgnore,
    recommendedProcessEnv,
  };
}

/**
 * @param {ReturnType<typeof buildDeployProfileBundlePlan>} plan
 * @returns {{ ok: true } | { ok: false; errors: string[] }}
 */
export function assertDeployProfileBundlePlanCoherent(plan) {
  /** @type {string[]} */
  const errors = [];
  const adminSet = new Set(plan.adminTranspileProducts);
  for (const row of plan.clientIgnore) {
    const expected = adminSet.has(row.packageName);
    if (row.inProfile !== expected) {
      errors.push(
        `${row.packageName}: inProfile=${row.inProfile} but admin transpile membership=${expected}`
      );
    }
    if (row.inProfile && plan.recommendedProcessEnv[row.envKey] !== "true") {
      errors.push(`${row.envKey}: in-profile package missing recommended ALLOW=true`);
    }
    if (!row.inProfile && plan.recommendedProcessEnv[row.envKey] === "true") {
      errors.push(`${row.envKey}: out-of-profile package must not recommend ALLOW=true`);
    }
  }
  if (!plan.applied) {
    // Full-trunk: guest runtime product count should match unfiltered collect (caller may compare).
  } else if (plan.profile !== "full" && plan.profile !== "*") {
    for (const pkg of plan.adminTranspileProducts) {
      const gated = plan.clientIgnore.find((row) => row.packageName === pkg);
      if (gated && gated.recommendedAllowEnv !== "true") {
        errors.push(`${pkg}: in filtered admin set but IgnorePlugin allow not recommended`);
      }
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Gap Closure D.2 — shell exports for recommended IgnorePlugin allow envs.
 * @param {{ readonly recommendedProcessEnv: Record<string, string> }} plan
 * @returns {string}
 */
export function formatDeployProfileAllowEnvExports(plan) {
  const keys = Object.keys(plan.recommendedProcessEnv ?? {}).sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) {
    return "# deploy-profile: no ALLOW_* recommendations (empty profile or no clientBundleEnvGate rows)\n";
  }
  return `${keys.map((key) => `export ${key}=${JSON.stringify(plan.recommendedProcessEnv[key])}`).join("\n")}\n`;
}

/**
 * ESM module for apps/web IgnorePlugin env gates (Wave H.j).
 * @param {import("../manifest-loader.mjs").WorkspaceManifest[]} manifests
 */
export function generateAdminClientWorkspaceIgnore(manifests) {
  const rows = collectAdminClientWorkspaceIgnoreRows(manifests);

  const ruleLines = rows.map((row) => {
    const source = `^${escapePackageNameForRegExpSource(row.packageName)}(\\/|$)`;
    return `  Object.freeze({
    envKey: ${JSON.stringify(row.envKey)},
    resourceRegExpSource: ${JSON.stringify(source)},
    label: ${JSON.stringify(row.id)},
    packageName: ${JSON.stringify(row.packageName)},
  }),`;
  });

  return `${BANNER}/** Wave H.j — admin client IgnorePlugin gates from workspace manifests (adminWeb.clientBundleEnvGate). */

/**
 * @typedef {{
 *   readonly envKey: string;
 *   readonly resourceRegExpSource: string;
 *   readonly label: string;
 *   readonly packageName: string;
 * }} AdminClientWorkspaceIgnoreRuleDef
 */

/** @type {readonly AdminClientWorkspaceIgnoreRuleDef[]} */
export const ADMIN_CLIENT_WORKSPACE_IGNORE_RULES = Object.freeze([
${ruleLines.join("\n")}
]);

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {readonly { envKey: string; resourceRegExp: RegExp; label: string; packageName: string }[]}
 */
export function resolveActiveAdminClientWorkspaceIgnoreRules(env = process.env) {
  return ADMIN_CLIENT_WORKSPACE_IGNORE_RULES.filter((rule) => env[rule.envKey] !== "true").map(
    (rule) =>
      Object.freeze({
        envKey: rule.envKey,
        label: rule.label,
        packageName: rule.packageName,
        resourceRegExp: new RegExp(rule.resourceRegExpSource),
      })
  );
}

/**
 * Expose only manifest-declared, non-secret bundle flags to client code.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {Readonly<Record<string, "true" | "false">>}
 */
export function resolveAdminClientWorkspaceBundleEnv(env = process.env) {
  return Object.freeze(
    Object.fromEntries(
      ADMIN_CLIENT_WORKSPACE_IGNORE_RULES.map((rule) => [
        rule.envKey,
        env[rule.envKey] === "true" ? "true" : "false",
      ])
    )
  );
}
`;
}

export function generateWorkspaceThemeStylesheets(manifests) {
  /** @type {Set<string>} */
  const importLines = new Set();
  for (const m of manifests) {
    const sheets = Array.isArray(m.themeStylesheets) ? m.themeStylesheets : [];
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(`${m.id}: themeStylesheets entries must be non-empty strings`);
      }
      importLines.add(`import "${m.package}/${sheet}";`);
    }
  }
  return `${BANNER}
${[...importLines].sort().join("\n")}
`;
}

/**
 * Per-plugin dynamic admin CSS loader — no eager import of all workspace admin skins.
 * @param {import("./generate-workspace-registry.mjs").WorkspaceManifest[]} manifests
 */
export function generateAdminThemeStylesheetLoader(manifests, env = process.env) {
  /** @type {{ id: string; package: string; sheets: string[] }[]} */
  const entries = [];
  const scoped = filterClientBundleManifests(manifests, env);
  for (const m of scoped) {
    const sheets = Array.isArray(m.themeStylesheets) ? m.themeStylesheets : [];
    if (sheets.length === 0) {
      continue;
    }
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(`${m.id}: themeStylesheets entries must be non-empty strings`);
      }
    }
    entries.push({ id: m.id, package: m.package, sheets: [...sheets] });
  }
  entries.sort((left, right) => left.id.localeCompare(right.id));

  const registryLines = entries
    .map(
      (entry) =>
        `  ${JSON.stringify(entry.id)}: Object.freeze([${entry.sheets.map((s) => JSON.stringify(s)).join(", ")}]),`
    )
    .join("\n");

  const switchCases = entries
    .map((entry) => {
      const imports = entry.sheets
        .map((sheet) => `      await import("${entry.package}/${sheet}");`)
        .join("\n");
      return `    case ${JSON.stringify(entry.id)}:\n${imports}\n      return;`;
    })
    .join("\n\n");

  return `${BANNER}
/** Manifest paths per workspace plugin (private; Phase 4h). */
const WORKSPACE_ADMIN_THEME_REGISTRY = Object.freeze({
${registryLines}
}) as Readonly<Record<string, readonly string[]>>;

/** Stylesheet path list for pluginId, if declared in manifest themeStylesheets. */
export function resolveAdminThemeStylesheets(
  pluginId: string
): readonly string[] | undefined {
  const id = pluginId.trim();
  if (id.length === 0) {
    return undefined;
  }
  return WORKSPACE_ADMIN_THEME_REGISTRY[id];
}

/** Plugin ids that declare admin themeStylesheets (tests / admission). */
export function listAdminThemeRegistryPluginIds(): readonly string[] {
  return Object.freeze(Object.keys(WORKSPACE_ADMIN_THEME_REGISTRY));
}

/** Load workspace admin skin CSS for the active plugin only (dynamic import). */
export async function importAdminThemeForPlugin(pluginId: string): Promise<void> {
  switch (pluginId) {
${switchCases}
    default:
      return;
  }
}
`;
}

/**
 * Ambient TypeScript module decls for workspace admin CSS packages (Gap Closure B.18).
 * Emitted as `*.generated.d.ts` so shell product-token ratchet does not count package path tokens.
 * @param {import("../manifest-loader.mjs").discoverManifests extends (...args: any) => infer R ? R : never} manifests
 */
export function generateWorkspaceThemeCssAmbientModules(manifests) {
  /** @type {Set<string>} */
  const modules = new Set();
  for (const m of manifests) {
    const sheets = Array.isArray(m.themeStylesheets) ? m.themeStylesheets : [];
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(`${m.id}: themeStylesheets entries must be non-empty strings`);
      }
      modules.add(`${m.package}/${sheet}`);
    }
  }
  const decls = [...modules]
    .sort()
    .map((spec) => `declare module ${JSON.stringify(spec)};`)
    .join("\n");
  return `${BANNER}
/** Workspace L3 admin skin CSS loaded via dynamic import (operator theme stack). */
${decls}
`;
}

export function generateGuestThemeStylesheets(manifests, surface) {
  if (typeof surface !== "string" || surface.trim().length === 0) {
    throw new Error("generateGuestThemeStylesheets: surface is required");
  }
  /** @type {Set<string>} */
  const importLines = new Set();
  for (const m of manifests) {
    const guest = m.guestThemeStylesheets;
    if (guest === undefined || guest === null) {
      continue;
    }
    if (typeof guest !== "object" || Array.isArray(guest)) {
      throw new Error(`${m.id}: guestThemeStylesheets must be an object keyed by app surface`);
    }
    const sheets = guest[surface];
    if (sheets === undefined) {
      continue;
    }
    if (!Array.isArray(sheets)) {
      throw new Error(`${m.id}: guestThemeStylesheets.${surface} must be an array`);
    }
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(
          `${m.id}: guestThemeStylesheets.${surface} entries must be non-empty strings`
        );
      }
      importLines.add(`import "${m.package}/${sheet}";`);
    }
  }
  return `${BANNER}
${[...importLines].sort().join("\n")}
`;
}

/**
 * Per-plugin dynamic CSS loader (marketing MKT-7 — no eager import of all workspace skins).
 * @param {import("./generate-workspace-registry.mjs").WorkspaceManifest[]} manifests
 * @param {string} surface
 */
export function generateGuestThemeStylesheetLoader(manifests, surface, env = process.env) {
  if (typeof surface !== "string" || surface.trim().length === 0) {
    throw new Error("generateGuestThemeStylesheetLoader: surface is required");
  }

  const surfaceCamel =
    surface === "marketing" ? "Marketing" : surface.charAt(0).toUpperCase() + surface.slice(1);

  /** @type {{ id: string; package: string; sheets: string[] }[]} */
  const entries = [];
  const scoped = filterClientBundleManifests(manifests, env);

  for (const m of scoped) {
    const guest = m.guestThemeStylesheets;
    if (guest === undefined || guest === null) {
      continue;
    }
    if (typeof guest !== "object" || Array.isArray(guest)) {
      throw new Error(`${m.id}: guestThemeStylesheets must be an object keyed by app surface`);
    }
    const sheets = guest[surface];
    if (sheets === undefined) {
      continue;
    }
    if (!Array.isArray(sheets) || sheets.length === 0) {
      throw new Error(`${m.id}: guestThemeStylesheets.${surface} must be a non-empty array`);
    }
    for (const sheet of sheets) {
      if (typeof sheet !== "string" || sheet.trim().length === 0) {
        throw new Error(
          `${m.id}: guestThemeStylesheets.${surface} entries must be non-empty strings`
        );
      }
    }
    entries.push({ id: m.id, package: m.package, sheets: [...sheets] });
  }

  entries.sort((left, right) => left.id.localeCompare(right.id));

  const registryLines = entries
    .map(
      (entry) =>
        `  ${JSON.stringify(entry.id)}: Object.freeze([${entry.sheets.map((s) => JSON.stringify(s)).join(", ")}]),`
    )
    .join("\n");

  const switchCases = entries
    .map((entry) => {
      const imports = entry.sheets
        .map((sheet) => `      await import("${entry.package}/${sheet}");`)
        .join("\n");
      return `    case ${JSON.stringify(entry.id)}:\n${imports}\n      return;`;
    })
    .join("\n\n");

  return `${BANNER}/// <reference path="./workspace-theme-css.d.ts" />

${
    surface === "portal"
      ? `
/** Starter workspace owns the default portal L3 skin (Phase D.2). */
export const WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN =
  "@app-tour/workspace-starter/theme/starter-portal.css" as const;
`
      : ""
  }${
    surface === "marketing"
      ? `
/** Starter workspace owns the default marketing L3 skin (Phase D.3). */
export const WORKSPACE_GUEST_MARKETING_DEFAULT_SKIN =
  "@app-tour/workspace-starter/theme/starter-marketing.css" as const;
`
      : ""
  }
/** Manifest paths per workspace plugin (documentation / guards). */
export const WORKSPACE_GUEST_${surface.toUpperCase()}_THEME_REGISTRY = Object.freeze({
${registryLines}
}) as Readonly<Record<string, readonly string[]>>;

/** Load workspace skin CSS for the active plugin only (dynamic import). */
export async function importGuest${surfaceCamel}ThemeForPlugin(pluginId: string): Promise<void> {
${surface === "portal" ? '  await import("@app-tour/workspace-starter/theme/starter-portal.css");\n' : ""}${surface === "marketing" ? '  await import("@app-tour/workspace-starter/theme/starter-marketing.css");\n' : ""}  switch (pluginId) {
${switchCases}
    default:
      return;
  }
}
`;
}
