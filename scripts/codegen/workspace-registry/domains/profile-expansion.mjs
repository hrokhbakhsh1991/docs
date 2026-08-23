import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { BANNER, REPO_ROOT } from "../constants.mjs";

export const PROFILE_CATALOG_DIR = join(REPO_ROOT, "profiles");

const PROFILE_RESERVED_KEYS = new Set([
  "id",
  "version",
  "package",
  "workspaceTypes",
  "plugin",
  "profile",
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deterministic deep merge — profile defaults first, author manifest wins leaves.
 * Arrays: author replaces profile entirely.
 *
 * @param {Record<string, unknown>} profileDefaults
 * @param {Record<string, unknown>} authorManifest
 * @returns {Record<string, unknown>}
 */
export function deepMergeProfileDefaults(profileDefaults, authorManifest) {
  /** @type {Record<string, unknown>} */
  const result = structuredClone(profileDefaults);
  for (const key of Object.keys(authorManifest).sort()) {
    const authorValue = authorManifest[key];
    const profileValue = result[key];
    if (Array.isArray(authorValue)) {
      result[key] = structuredClone(authorValue);
      continue;
    }
    if (isPlainObject(authorValue) && isPlainObject(profileValue)) {
      result[key] = deepMergeProfileDefaults(
        /** @type {Record<string, unknown>} */ (profileValue),
        authorValue
      );
      continue;
    }
    result[key] = authorValue;
  }
  return result;
}

/**
 * @param {Record<string, unknown>} profileDefaults
 * @param {Record<string, unknown>} authorManifest
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function collectProfileOverridePaths(profileDefaults, authorManifest, prefix = "") {
  /** @type {string[]} */
  const paths = [];
  for (const key of Object.keys(authorManifest).sort()) {
    if (PROFILE_RESERVED_KEYS.has(key)) {
      continue;
    }
    const path = prefix.length > 0 ? `${prefix}.${key}` : key;
    const authorValue = authorManifest[key];
    const profileValue = profileDefaults[key];
    if (profileValue === undefined) {
      if (authorValue !== undefined) {
        paths.push(path);
      }
      continue;
    }
    if (Array.isArray(authorValue)) {
      if (JSON.stringify(authorValue) !== JSON.stringify(profileValue)) {
        paths.push(path);
      }
      continue;
    }
    if (isPlainObject(authorValue) && isPlainObject(profileValue)) {
      paths.push(
        ...collectProfileOverridePaths(
          /** @type {Record<string, unknown>} */ (profileValue),
          authorValue,
          path
        )
      );
      continue;
    }
    if (authorValue !== profileValue) {
      paths.push(path);
    }
  }
  return paths.sort();
}

/**
 * @returns {Map<string, Record<string, unknown>>}
 */
export function loadProfileCatalog() {
  /** @type {Map<string, Record<string, unknown>>} */
  const catalog = new Map();
  if (!existsSync(PROFILE_CATALOG_DIR)) {
    return catalog;
  }
  for (const ent of readdirSync(PROFILE_CATALOG_DIR, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith(".profile.json")) {
      continue;
    }
    const filePath = join(PROFILE_CATALOG_DIR, ent.name);
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    if (typeof raw.id !== "string" || raw.id.trim().length === 0) {
      throw new Error(`${filePath}: profile id is required`);
    }
    if (raw.profile !== undefined) {
      throw new Error(`${filePath}: PROFILE_CHAIN_FORBIDDEN — profile files cannot reference profiles`);
    }
    if (!isPlainObject(raw.capabilityDefaults)) {
      throw new Error(`${filePath}: capabilityDefaults object is required`);
    }
    if (raw.capabilityDefaults.workspacePolicy !== undefined) {
      throw new Error(
        `${filePath}: workspacePolicy forbidden in profile catalog — author manifest only`
      );
    }
    if (catalog.has(raw.id)) {
      throw new Error(`${filePath}: duplicate profile id "${raw.id}"`);
    }
    catalog.set(raw.id, raw);
  }
  return catalog;
}

/**
 * @param {Record<string, unknown>} authorManifest
 * @param {Map<string, Record<string, unknown>>} catalog
 * @returns {{ effective: Record<string, unknown>, audit: { profileId: string, overriddenPaths: string[] } | null }}
 */
export function expandAuthorManifest(authorManifest, catalog) {
  const profileRef = authorManifest.profile;
  if (profileRef === undefined) {
    return { effective: authorManifest, audit: null };
  }
  if (typeof profileRef !== "string" || profileRef.trim().length === 0) {
    throw new Error(
      `workspace.manifest.json ${authorManifest.id}: profile must be a non-empty string slug`
    );
  }
  const profileEntry = catalog.get(profileRef);
  if (profileEntry === undefined) {
    throw new Error(
      `workspace.manifest.json ${authorManifest.id}: PROFILE_NOT_FOUND — unknown profile "${profileRef}"`
    );
  }
  const capabilityDefaults = /** @type {Record<string, unknown>} */ (
    profileEntry.capabilityDefaults
  );
  const overriddenPaths = collectProfileOverridePaths(capabilityDefaults, authorManifest);
  const merged = deepMergeProfileDefaults(capabilityDefaults, authorManifest);
  const { profile: _profile, ...effective } = merged;
  return {
    effective,
    audit: {
      profileId: profileRef,
      overriddenPaths,
    },
  };
}

/**
 * @param {readonly Record<string, unknown>[]} authorManifests
 * @returns {readonly Record<string, unknown>[]}
 */
export function applyProfileExpansion(authorManifests) {
  const catalog = loadProfileCatalog();
  return authorManifests.map((manifest) => {
    const { effective } = expandAuthorManifest(manifest, catalog);
    return effective;
  });
}

/**
 * @param {readonly Record<string, unknown>[]} authorManifests
 */
export function generateProfileExpansionAudit(authorManifests) {
  const catalog = loadProfileCatalog();
  /** @type {string[]} */
  const auditEntries = [];

  for (const author of authorManifests) {
    const { audit } = expandAuthorManifest(author, catalog);
    if (audit === null) {
      auditEntries.push(`  ${JSON.stringify(author.id)}: null,`);
      continue;
    }
    auditEntries.push(`  ${JSON.stringify(author.id)}: {
    profileId: ${JSON.stringify(audit.profileId)},
    overriddenPaths: ${JSON.stringify(audit.overriddenPaths)},
  },`);
  }

  if (auditEntries.length === 0) {
    return `${BANNER}
export type WorkspaceProfileExpansionAuditEntry = {
  readonly profileId: string;
  readonly overriddenPaths: readonly string[];
};

export const WORKSPACE_PROFILE_EXPANSION_AUDIT = {} as const satisfies Record<
  string,
  WorkspaceProfileExpansionAuditEntry | null
>;
`;
  }

  return `${BANNER}
export type WorkspaceProfileExpansionAuditEntry = {
  readonly profileId: string;
  readonly overriddenPaths: readonly string[];
};

export const WORKSPACE_PROFILE_EXPANSION_AUDIT = {
${auditEntries.join("\n")}
} as const satisfies Record<string, WorkspaceProfileExpansionAuditEntry | null>;
`;
}
