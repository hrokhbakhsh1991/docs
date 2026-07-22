/**
 * Gap Closure C.2 / C.3 — deploy-profile resolve + package/manifest filters.
 * Kept free of registration/theme imports so both domains can consume without cycles.
 */

/**
 * True when a dependency name is a product workspace package (not sdk / plugin-host).
 * @param {string} name
 */
export function isGuestRuntimeProductWorkspaceDep(name) {
  if (name === "@app-tour/workspace-sdk" || name === "@app-tour/workspace-plugin-host") {
    return false;
  }
  return name.startsWith("@app-tour/workspace-");
}

/**
 * Gap Closure C.2a — filter product package lists by deploy profile.
 * - null / "" / "*" / "full" → unchanged (monorepo full-trunk default)
 * - comma-separated workspace ids (`denali`) or package names (`@app-tour/workspace-denali`)
 * @param {readonly string[]} packages
 * @param {string | null | undefined} profile
 * @returns {string[]}
 */
export function filterProductPackagesByDeployProfile(packages, profile) {
  const raw = typeof profile === "string" ? profile.trim() : "";
  if (raw.length === 0 || raw === "*" || raw === "full") {
    return [...packages];
  }
  /** @type {Set<string>} */
  const allowed = new Set();
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (token.length === 0) continue;
    allowed.add(token);
    if (token.startsWith("@app-tour/workspace-")) {
      allowed.add(token.slice("@app-tour/workspace-".length));
    } else if (!token.startsWith("@")) {
      allowed.add(`@app-tour/workspace-${token}`);
    }
  }
  return packages.filter((pkg) => {
    if (allowed.has(pkg)) return true;
    const id = pkg.startsWith("@app-tour/workspace-")
      ? pkg.slice("@app-tour/workspace-".length)
      : pkg;
    return allowed.has(id);
  });
}

/**
 * Gap Closure C.2b — resolve deploy profile for transpile / register / theme codegen.
 * Filtering requires WORKSPACE_DEPLOY_PROFILE_APPLY=1; otherwise always "full".
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{ readonly profile: string; readonly applied: boolean }}
 */
export function resolveWorkspaceDeployProfile(env = process.env) {
  if (env.WORKSPACE_DEPLOY_PROFILE_APPLY !== "1") {
    return { profile: "full", applied: false };
  }
  const raw =
    typeof env.WORKSPACE_DEPLOY_PROFILE === "string" ? env.WORKSPACE_DEPLOY_PROFILE.trim() : "";
  if (raw.length === 0) {
    return { profile: "full", applied: true };
  }
  return { profile: raw, applied: true };
}

/**
 * @param {readonly string[]} packages
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {{ readonly packages: string[]; readonly profileNote: string | null }}
 */
export function applyDeployProfileToProductPackages(packages, env = process.env) {
  const resolved = resolveWorkspaceDeployProfile(env);
  if (!resolved.applied) {
    return { packages: [...packages], profileNote: null };
  }
  const filtered = filterProductPackagesByDeployProfile(packages, resolved.profile);
  return {
    packages: filtered,
    profileNote: `Deploy profile apply=1 profile=${JSON.stringify(resolved.profile)} products=${filtered.length}`,
  };
}

/**
 * Gap Closure C.3 — filter manifests whose package is out of deploy profile (APPLY only).
 * @param {readonly { package?: string }[]} manifests
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function filterManifestsByDeployProfile(manifests, env = process.env) {
  const resolved = resolveWorkspaceDeployProfile(env);
  if (!resolved.applied) {
    return manifests;
  }
  const packages = manifests.map((m) => m.package).filter((p) => typeof p === "string");
  const allowed = new Set(filterProductPackagesByDeployProfile(packages, resolved.profile));
  return manifests.filter((m) => typeof m.package === "string" && allowed.has(m.package));
}
