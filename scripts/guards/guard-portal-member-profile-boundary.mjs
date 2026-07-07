#!/usr/bin/env node
/**
 * Portal member profile boundary — M4/M6/M7 production freeze
 * @see docs/phase-19/platform-portal-member-profile.mdoc (GR-MP-01..08)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectContractAlignmentFindings } from "./lib/member-profile-architecture-truth.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORTAL_ROOT = path.join(REPO_ROOT, "apps/portal");

const IDENTITY_ME_ALLOWLIST = new Set([
  "apps/portal/app/api/me/profile/route.ts",
  "apps/portal/app/api/me/avatar/route.ts",
  "apps/portal/app/api/me/avatar/url/route.ts",
  "apps/portal/app/api/me/mobile/request-otp/route.ts",
  "apps/portal/app/api/me/mobile/verify/route.ts",
  "apps/portal/src/me/fetch-member-profile-from-session.server.ts",
  "apps/portal/src/me/member-entitlements-bff.server.ts",
]);

const PROFILE_DOMAIN_PREFIXES = [
  "apps/portal/app/me/profile/",
  "apps/portal/app/api/me/profile/",
  "apps/portal/src/me/member-profile",
  "apps/portal/src/me/fetch-member-profile",
  "apps/portal/src/me/resolve-member-profile",
];

const SCAN_ROOTS = ["app", "src"].map((segment) => path.join(PORTAL_ROOT, segment));

const IDENTITY_ME_PATTERN = /identity\/me/;
const IDENTITY_ME_URL_PATTERN =
  /(?:resolveTourOpsApiBaseUrl\(\)[^;\n]*identity\/me|fetch\([^)]*identity\/me)/;
const SESSION_PROFILE_PATTERN = /session-profile/;
const WORKSPACE_IMPORT_PATTERN =
  /(?:from\s+["']@app-tour\/workspace-(?!sdk(?:\/|["']))|from\s+["'][^"']*packages\/workspaces\/|require\(["']@app-tour\/workspace-(?!sdk))/;
const PLUGIN_BRANCH_PATTERN = /pluginId\s*===\s*["']|workspace\s*===\s*["']/;

const CONTRACT_SNAPSHOT_REL = "apps/portal/src/me/member-profile-contract-v1.snapshot.json";
const SDK_FIELD_ID_REL = "packages/workspace-sdk/src/profile/member-profile-field-id.ts";
const BFF_MAPPING_REL = "apps/portal/src/me/member-profile-bff.server.ts";

/** @type {string[]} */
const failures = [];

function read(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

function toRepoRelative(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

function isProfileDomainFile(relPath) {
  return PROFILE_DOMAIN_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function listSourceFiles(dir) {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }
      files.push(...listSourceFiles(absPath));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(absPath);
    }
  }
  return files;
}

function fail(id, detail) {
  failures.push(`${id}: ${detail}`);
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function extractQuotedIdentifiers(source) {
  return sortedUnique([...source.matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1] ?? ""));
}

function extractBffIdentityFieldReaders(source) {
  const blockMatch = /IDENTITY_FIELD_READERS[\s\S]*?Object\.freeze\(\{([\s\S]*?)\}\)/.exec(source);
  if (blockMatch === null) {
    return [];
  }
  return sortedUnique([...blockMatch[1].matchAll(/^\s*([a-zA-Z]+):/gm)].map((match) => match[1] ?? ""));
}

function assertContractSnapshotAlignment() {
  if (!exists(CONTRACT_SNAPSHOT_REL)) {
    fail("mp_guard_contract_snapshot_exists", `${CONTRACT_SNAPSHOT_REL} is required`);
    return;
  }

  const snapshot = JSON.parse(read(CONTRACT_SNAPSHOT_REL));
  if (snapshot.contractVersion !== "v1") {
    fail("mp_guard_contract_snapshot_version", "contract snapshot must remain v1 until explicit migration");
  }

  const snapshotFieldIds = sortedUnique(snapshot.memberProfileFieldIds ?? []);
  const sdkFieldIds = extractQuotedIdentifiers(read(SDK_FIELD_ID_REL));
  if (snapshotFieldIds.join("|") !== sdkFieldIds.join("|")) {
    fail(
      "mp_guard_contract_sdk_field_alignment",
      `snapshot field ids diverge from SDK (${snapshotFieldIds.join(",")} vs ${sdkFieldIds.join(",")})`
    );
  }

  const bffFieldIds = extractBffIdentityFieldReaders(read(BFF_MAPPING_REL));
  if (snapshotFieldIds.join("|") !== bffFieldIds.join("|")) {
    fail(
      "mp_guard_contract_bff_field_alignment",
      `snapshot field ids diverge from BFF identity readers (${snapshotFieldIds.join(",")} vs ${bffFieldIds.join(",")})`
    );
  }

  if (snapshot.portalProfileEntrypoint !== "/api/me/profile") {
    fail("mp_guard_contract_entrypoint", "portal profile entrypoint must remain /api/me/profile");
  }
}

const legacySessionProfileRoute = path.join(
  PORTAL_ROOT,
  "app/api/public-auth/session-profile/route.ts"
);
if (fs.existsSync(legacySessionProfileRoute)) {
  fail(
    "mp_guard_session_profile_removed",
    "apps/portal/app/api/public-auth/session-profile/route.ts must be deleted"
  );
}

for (const scanRoot of SCAN_ROOTS) {
  for (const absPath of listSourceFiles(scanRoot)) {
    const relPath = toRepoRelative(absPath);
    const source = fs.readFileSync(absPath, "utf8");

    if (SESSION_PROFILE_PATTERN.test(source)) {
      fail("mp_guard_no_session_profile", `${relPath} must not reference session-profile`);
    }

    if (IDENTITY_ME_PATTERN.test(source) && !IDENTITY_ME_ALLOWLIST.has(relPath)) {
      fail(
        "mp_guard_identity_me_bff_only",
        `${relPath} must not call identity/me — use /api/me/profile BFF only`
      );
    }

    if (IDENTITY_ME_URL_PATTERN.test(source) && !IDENTITY_ME_ALLOWLIST.has(relPath)) {
      fail(
        "mp_guard_identity_url_bff_only",
        `${relPath} must not build identity/me upstream URLs outside profile BFF`
      );
    }

    if (relPath === "apps/portal/src/me/fetch-member-profile.server.ts") {
      if (!source.includes("/api/me/profile")) {
        fail("mp_guard_ssr_bff_entrypoint", "fetchMemberProfile must call /api/me/profile only");
      }
      if (IDENTITY_ME_PATTERN.test(source) || source.includes("resolveTourOpsApiBaseUrl")) {
        fail("mp_guard_ssr_no_identity", "fetchMemberProfile must not call identity/me directly");
      }
    }

    if (!isProfileDomainFile(relPath)) {
      continue;
    }

    if (WORKSPACE_IMPORT_PATTERN.test(source)) {
      fail("mp_guard_no_workspace_imports", `${relPath} must not import workspace packages`);
    }

    if (PLUGIN_BRANCH_PATTERN.test(source)) {
      fail("mp_guard_no_plugin_branching", `${relPath} must not branch on pluginId/workspace`);
    }
  }
}

const profileBffRoute = path.join(PORTAL_ROOT, "app/api/me/profile/route.ts");
if (!fs.existsSync(profileBffRoute)) {
  fail("mp_guard_profile_bff_exists", "apps/portal/app/api/me/profile/route.ts is required");
} else {
  const profileBff = fs.readFileSync(profileBffRoute, "utf8");
  if (!/export async function GET/.test(profileBff) || !/export async function PATCH/.test(profileBff)) {
    fail("mp_guard_profile_bff_handlers", "profile BFF must export GET and PATCH");
  }
  if (!IDENTITY_ME_PATTERN.test(profileBff)) {
    fail("mp_guard_profile_bff_upstream", "profile BFF must proxy identity/me");
  }
  if (!profileBff.includes("resolveMemberProfileTraceId")) {
    fail("mp_guard_profile_bff_trace", "profile BFF must propagate traceId (M6)");
  }
  if (!profileBff.includes("readMemberProfileCache")) {
    fail("mp_guard_profile_bff_cache", "profile BFF must use member profile cache layer");
  }
}

const profilePage = path.join(PORTAL_ROOT, "app/me/profile/page.tsx");
if (fs.existsSync(profilePage)) {
  const pageSource = fs.readFileSync(profilePage, "utf8");
  if (!/fetchMemberProfile/.test(pageSource)) {
    fail("mp_guard_ssr_fetch_member_profile", "profile page SSR must use fetchMemberProfile()");
  }
}

const requiredM6Modules = [
  "apps/portal/src/me/member-profile-contract-v1.snapshot.json",
  "apps/portal/src/me/member-profile-cache-store.server.ts",
  "apps/portal/src/me/member-profile-trace.server.ts",
  "apps/portal/src/me/member-profile-contract-alignment.server.ts",
];
for (const rel of requiredM6Modules) {
  if (!exists(rel)) {
    fail(`mp_guard_m6_module_${path.basename(rel)}`, `missing ${rel}`);
  }
}

const requiredM7Modules = [
  "apps/portal/src/me/member-profile-runtime-truth.server.ts",
];
for (const rel of requiredM7Modules) {
  if (!exists(rel)) {
    fail(`mp_guard_m7_module_${path.basename(rel)}`, `missing ${rel}`);
  }
}

const contractFindings = collectContractAlignmentFindings(REPO_ROOT);
for (const finding of contractFindings) {
  if (finding.severity === "HIGH") {
    fail(finding.type, `${finding.file}: ${finding.message}`);
  }
}

/** @type {string[]} */
const warnings = [];
for (const finding of contractFindings) {
  if (finding.severity === "LOW") {
    warnings.push(`${finding.type}: ${finding.message}`);
  }
}

assertContractSnapshotAlignment();

if (failures.length > 0) {
  console.error("\nguard-portal-member-profile-boundary — FAIL");
  for (const message of failures) {
    console.error(`  ✗ ${message}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  for (const message of warnings) {
    console.warn(`  ⚠ ${message}`);
  }
}

console.log("guard-portal-member-profile-boundary — PASS");
