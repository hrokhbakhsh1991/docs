/**
 * Member profile architecture truth governance (M7).
 * @see docs/phase-19/platform-portal-member-profile.mdoc
 */
import fs from "node:fs";
import path from "node:path";

export const TRUTH_PRIORITY = Object.freeze([
  "runtime_behavior",
  "api_bff_implementation",
  "sdk_contracts",
  "snapshot_schema",
  "documentation",
]);

export const DRIFT_REPORT_REL = "docs/phase-19/architecture-truth-drift-report.json";

const DOC_PATHS = [
  "docs/phase-19/platform-portal-member-profile.mdoc",
  "docs/phase-19/platform-portal-member.mdoc",
  "docs/workspaces/denali/portal-member-profile.md",
];

const CONTRACT_SNAPSHOT_REL = "apps/portal/src/me/member-profile-contract-v1.snapshot.json";
const SDK_FIELD_ID_REL = "packages/workspace-sdk/src/profile/member-profile-field-id.ts";
const BFF_MAPPING_REL = "apps/portal/src/me/member-profile-bff.server.ts";
const PROFILE_BFF_ROUTE_REL = "apps/portal/app/api/me/profile/route.ts";
const AVATAR_BFF_ROUTE_REL = "apps/portal/app/api/me/avatar/route.ts";
const AVATAR_URL_BFF_ROUTE_REL = "apps/portal/app/api/me/avatar/url/route.ts";
const MOBILE_REQUEST_BFF_ROUTE_REL = "apps/portal/app/api/me/mobile/request-otp/route.ts";
const MOBILE_VERIFY_BFF_ROUTE_REL = "apps/portal/app/api/me/mobile/verify/route.ts";
const SESSION_PROFILE_ROUTE_REL = "apps/portal/app/api/public-auth/session-profile/route.ts";

const RESUME_PROFILE_LOADER_REL =
  "apps/portal/src/me/fetch-member-profile-from-session.server.ts";

const IDENTITY_ME_ALLOWLIST = new Set([
  PROFILE_BFF_ROUTE_REL,
  AVATAR_BFF_ROUTE_REL,
  AVATAR_URL_BFF_ROUTE_REL,
  MOBILE_REQUEST_BFF_ROUTE_REL,
  MOBILE_VERIFY_BFF_ROUTE_REL,
  RESUME_PROFILE_LOADER_REL,
]);

/** @typedef {{ file: string, line?: number, type: string, severity: "LOW" | "MEDIUM" | "HIGH", message: string }} ArchitectureTruthFinding */

function read(repoRoot, relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function exists(repoRoot, relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
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

function lineAllowsLegacyMention(line) {
  return /removed|REMOVED|deprecated|deleted|must not|doesNotMatch|MIGRATE|legacy|historical|pre-migration|RESOLVED|✅ M[2345678]|BLOCK|VIOLATION.*Critical/i.test(
    line
  );
}

/**
 * @param {string} relPath
 * @param {string} content
 * @returns {ArchitectureTruthFinding[]}
 */
function scanDocumentationDrift(relPath, content) {
  /** @type {ArchitectureTruthFinding[]} */
  const findings = [];
  const lines = content.split("\n");

  const docRules = [
    {
      type: "doc_forbidden_session_profile_active",
      severity: "HIGH",
      test: (line) => /session-profile\s*\(active\)/i.test(line),
      message: 'Doc contains forbidden phrase "session-profile (active)"',
    },
    {
      type: "doc_forbidden_direct_identity_ui",
      severity: "HIGH",
      test: (line) =>
        /direct identity\/me usage in portal UI/i.test(line) && !lineAllowsLegacyMention(line),
      message: "Doc contains forbidden direct identity/me portal UI claim",
    },
    {
      type: "doc_forbidden_unfrozen_bff",
      severity: "HIGH",
      test: (line) => /unfrozen BFF status/i.test(line),
      message: "Doc contains forbidden unfrozen BFF status claim",
    },
    {
      type: "doc_forbidden_three_field_only",
      severity: "HIGH",
      test: (line) =>
        /3-field-only profile implementation/i.test(line) && !lineAllowsLegacyMention(line),
      message: "Doc contains outdated 3-field-only profile claim",
    },
    {
      type: "doc_stale_session_profile_active",
      severity: "HIGH",
      test: (line) =>
        /session-profile/i.test(line) &&
        !lineAllowsLegacyMention(line) &&
        !/REMOVED M4|removed \*M4|does not call/i.test(line),
      message: "Doc references session-profile without marking it removed/legacy",
    },
    {
      type: "doc_stale_direct_identity_ssr",
      severity: "HIGH",
      test: (line) =>
        (/Direct.*identity\/me/i.test(line) ||
          /fetchSessionProfile/i.test(line) ||
          /GET apps\/api\/identity\/me/i.test(line) ||
          /resolveTourOpsApiBaseUrl\(\)\}\/identity\/me/i.test(line)) &&
        !lineAllowsLegacyMention(line) &&
        !/must not|BFF must proxy|→ `GET \/identity\/me`/i.test(line),
      message: "Doc claims direct portal identity/me SSR bypass (stale)",
    },
    {
      type: "doc_stale_bff_not_landed",
      severity: "HIGH",
      test: (line) => /not landed yet/i.test(line) && /profile|\/api\/me\/profile/i.test(line),
      message: "Doc claims profile BFF is not landed while route exists",
    },
    {
      type: "doc_stale_hardcoded_three_fields",
      severity: "HIGH",
      test: (line) =>
        (/hardcoded 3 field/i.test(line) || /3-field-only/i.test(line) || /Hardcoded 3 fields/i.test(line)) &&
        /\| Today \||\| SSR load \|/i.test(line),
      message: "Doc status table still lists hardcoded 3-field profile as current",
    },
    {
      type: "doc_stale_capabilities_missing",
      severity: "HIGH",
      test: (line) =>
        /resolveMemberProfileCapabilities/i.test(line) &&
        (/does not exist/i.test(line) || /No — does not exist/i.test(line)),
      message: "Doc claims resolveMemberProfileCapabilities does not exist",
    },
    {
      type: "doc_stale_session_profile_patch",
      severity: "HIGH",
      test: (line) =>
        /PATCH.*session-profile|session-profile.*PATCH/i.test(line) && !lineAllowsLegacyMention(line),
      message: "Doc lists session-profile PATCH as an active write path",
    },
    {
      type: "doc_stale_reality_audit",
      severity: "MEDIUM",
      test: (line, index, allLines) => {
        const sectionIdx = allLines.findIndex((l) => l.includes("CODEBASE REALITY AUDIT"));
        if (sectionIdx === -1 || index < sectionIdx) {
          return false;
        }
        return (
          /fetchSessionProfile|PATCH session-profile|GET session-profile|Direct.*identity\/me/i.test(
            line
          ) && !lineAllowsLegacyMention(line)
        );
      },
      message: "CODEBASE REALITY AUDIT section contains stale pre-M3/M4 claims",
    },
    {
      type: "doc_gap_table_violation_stale",
      severity: "MEDIUM",
      test: (line) =>
        /\| Single profile BFF \||\| SSR bypass \||Split: direct API \+ `session-profile`/i.test(line) &&
        /\*\*VIOLATION\*\*/i.test(line),
      message: "GAP table still marks resolved profile BFF violations as active",
    },
    {
      type: "doc_endpoint_not_in_code",
      severity: "LOW",
      test: (line) =>
        /`GET \/api\/public-auth\/session-profile`/i.test(line) &&
        !/MIGRATE|REMOVE|removed/i.test(line),
      message: "Doc lists session-profile GET without migrate/remove context",
    },
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNo = i + 1;
    for (const rule of docRules) {
      if (rule.test(line, i, lines)) {
        findings.push({
          file: relPath,
          line: lineNo,
          type: rule.type,
          severity: rule.severity,
          message: rule.message,
        });
      }
    }
  }

  return findings;
}

/**
 * @param {string} repoRoot
 * @returns {ArchitectureTruthFinding[]}
 */
export function collectCodeTruthFindings(repoRoot) {
  /** @type {ArchitectureTruthFinding[]} */
  const findings = [];
  const portalRoot = path.join(repoRoot, "apps/portal");

  if (exists(repoRoot, SESSION_PROFILE_ROUTE_REL)) {
    findings.push({
      file: SESSION_PROFILE_ROUTE_REL,
      type: "code_legacy_session_profile_route",
      severity: "HIGH",
      message: "Legacy session-profile route file still exists",
    });
  }

  if (!exists(repoRoot, PROFILE_BFF_ROUTE_REL)) {
    findings.push({
      file: PROFILE_BFF_ROUTE_REL,
      type: "code_missing_profile_bff",
      severity: "HIGH",
      message: "Canonical profile BFF route is missing",
    });
  }

  function listPortalSources(dir) {
    /** @type {string[]} */
    const files = [];
    if (!fs.existsSync(dir)) {
      return files;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") {
          continue;
        }
        files.push(...listPortalSources(abs));
        continue;
      }
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(abs);
      }
    }
    return files;
  }

  for (const segment of ["app", "src"]) {
    for (const absPath of listPortalSources(path.join(portalRoot, segment))) {
      const relPath = path.relative(repoRoot, absPath).split(path.sep).join("/");
      const source = fs.readFileSync(absPath, "utf8");
      if (/session-profile/.test(source)) {
        findings.push({
          file: relPath,
          line: undefined,
          type: "code_session_profile_reference",
          severity: "HIGH",
          message: "Portal source references session-profile",
        });
      }
      if (/identity\/me/.test(source) && !IDENTITY_ME_ALLOWLIST.has(relPath)) {
        findings.push({
          file: relPath,
          type: "code_identity_me_outside_bff",
          severity: "HIGH",
          message: "Portal source calls identity/me outside profile BFF allowlist",
        });
      }
    }
  }

  if (
    exists(repoRoot, "apps/portal/app/me/profile/page.tsx") &&
    !read(repoRoot, "apps/portal/app/me/profile/page.tsx").includes("fetchMemberProfile")
  ) {
    findings.push({
      file: "apps/portal/app/me/profile/page.tsx",
      type: "code_ssr_not_using_bff",
      severity: "HIGH",
      message: "Profile SSR page must use fetchMemberProfile()",
    });
  }

  return findings;
}

/**
 * @param {string} repoRoot
 * @returns {ArchitectureTruthFinding[]}
 */
export function collectContractAlignmentFindings(repoRoot) {
  /** @type {ArchitectureTruthFinding[]} */
  const findings = [];

  if (!exists(repoRoot, CONTRACT_SNAPSHOT_REL)) {
    findings.push({
      file: CONTRACT_SNAPSHOT_REL,
      type: "contract_snapshot_missing",
      severity: "HIGH",
      message: "Contract snapshot file is missing",
    });
    return findings;
  }

  const snapshot = JSON.parse(read(repoRoot, CONTRACT_SNAPSHOT_REL));
  const snapshotFieldIds = sortedUnique(snapshot.memberProfileFieldIds ?? []);
  const sdkFieldIds = extractQuotedIdentifiers(read(repoRoot, SDK_FIELD_ID_REL));
  const bffFieldIds = extractBffIdentityFieldReaders(read(repoRoot, BFF_MAPPING_REL));

  if (snapshot.contractVersion !== "v1") {
    findings.push({
      file: CONTRACT_SNAPSHOT_REL,
      type: "contract_snapshot_version",
      severity: "HIGH",
      message: "Snapshot contractVersion must remain v1 until explicit migration",
    });
  }

  if (snapshotFieldIds.join("|") !== sdkFieldIds.join("|")) {
    findings.push({
      file: CONTRACT_SNAPSHOT_REL,
      type: "contract_snapshot_sdk_drift",
      severity: "HIGH",
      message: `Snapshot field ids diverge from SDK (${snapshotFieldIds.join(",")} vs ${sdkFieldIds.join(",")})`,
    });
  }

  if (snapshotFieldIds.join("|") !== bffFieldIds.join("|")) {
    findings.push({
      file: CONTRACT_SNAPSHOT_REL,
      type: "contract_snapshot_bff_drift",
      severity: "HIGH",
      message: `Snapshot field ids diverge from BFF readers (${snapshotFieldIds.join(",")} vs ${bffFieldIds.join(",")})`,
    });
  }

  for (const sdkField of sdkFieldIds) {
    if (!bffFieldIds.includes(sdkField)) {
      findings.push({
        file: BFF_MAPPING_REL,
        type: "sdk_field_missing_in_bff",
        severity: "LOW",
        message: `SDK field "${sdkField}" is not mapped in BFF identity readers`,
      });
    }
  }

  for (const bffField of bffFieldIds) {
    if (!sdkFieldIds.includes(bffField)) {
      findings.push({
        file: BFF_MAPPING_REL,
        type: "bff_field_not_in_sdk",
        severity: "HIGH",
        message: `BFF exposes field "${bffField}" that is not in SDK field-id union`,
      });
    }
  }

  return findings;
}

/**
 * @param {string} repoRoot
 * @param {{ docsOnly?: boolean }} [options]
 * @returns {ArchitectureTruthFinding[]}
 */
export function collectArchitectureTruthFindings(repoRoot, options = {}) {
  /** @type {ArchitectureTruthFinding[]} */
  const findings = [];

  for (const relPath of DOC_PATHS) {
    if (!exists(repoRoot, relPath)) {
      findings.push({
        file: relPath,
        type: "doc_missing",
        severity: "MEDIUM",
        message: "Expected architecture doc is missing",
      });
      continue;
    }
    findings.push(...scanDocumentationDrift(relPath, read(repoRoot, relPath)));
  }

  if (!options.docsOnly) {
    findings.push(...collectCodeTruthFindings(repoRoot));
    findings.push(...collectContractAlignmentFindings(repoRoot));
  }

  return findings;
}

/**
 * @param {string} repoRoot
 * @param {ArchitectureTruthFinding[]} findings
 */
export function writeArchitectureTruthDriftReport(repoRoot, findings) {
  const reportPath = path.join(repoRoot, DRIFT_REPORT_REL);
  const payload = {
    generatedAt: new Date().toISOString(),
    truthPriority: TRUTH_PRIORITY,
    summary: {
      total: findings.length,
      high: findings.filter((f) => f.severity === "HIGH").length,
      medium: findings.filter((f) => f.severity === "MEDIUM").length,
      low: findings.filter((f) => f.severity === "LOW").length,
    },
    findings,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`);
  return reportPath;
}

export function hasBlockingArchitectureTruthDrift(findings) {
  return findings.some((finding) => finding.severity === "HIGH");
}
