#!/usr/bin/env node

/**
 * Classify a change set into the smallest safe CI surface.
 *
 * This is deliberately conservative: a path that cannot be classified is a
 * full-impact change. The classifier is pure so it can be tested without a
 * checkout, a database, or GitHub credentials.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ALL_DOMAINS = [
  "api",
  "web",
  "portal",
  "marketing",
  "booking",
  "finance",
  "ticketing",
  "workspace-denali",
  "security",
  "docs",
];

const DOMAIN_ORDER = new Map(ALL_DOMAINS.map((domain, index) => [domain, index]));

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => {
    const leftIndex = DOMAIN_ORDER.has(left) ? DOMAIN_ORDER.get(left) : Number.MAX_SAFE_INTEGER;
    const rightIndex = DOMAIN_ORDER.has(right) ? DOMAIN_ORDER.get(right) : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || left.localeCompare(right);
  });
}

function add(result, domains, reason, options = {}) {
  result.domains.push(...domains);
  if (reason) result.reasons.push(reason);
  if (options.full) result.full = true;
  if (options.unknown) result.unknownPaths.push(options.path);
  if (options.postgres) result.tiers.postgres = true;
  if (options.playwright) result.tiers.playwright = true;
  if (options.security) result.tiers.security = true;
}

function classifyPath(path, result) {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");

  if (!normalized || normalized.startsWith(".git/")) return;

  if (
    normalized === "pnpm-lock.yaml" ||
    normalized === "package.json" ||
    normalized.startsWith(".github/") ||
    normalized.startsWith(".husky/") ||
    normalized.startsWith("scripts/") ||
    normalized.startsWith("infra/") ||
    normalized.startsWith("tsconfig") ||
    normalized.startsWith("pnpm-workspace")
  ) {
    add(result, ALL_DOMAINS, `shared CI/control-plane change: ${normalized}`, { full: true });
    return;
  }

  if (
    /^(prisma|migrations|database|db)\//.test(normalized) ||
    /(^|\/)(schema|migration)\.(prisma|sql)$/.test(normalized)
  ) {
    add(
      result,
      ["api", "booking", "finance", "ticketing", "security"],
      `database contract change: ${normalized}`,
      {
        full: true,
        postgres: true,
      }
    );
    return;
  }

  if (normalized.startsWith("docs/") || normalized.startsWith("reports/")) {
    if (/phase-|migration|contract|architecture|security|ci/i.test(normalized)) {
      add(result, ALL_DOMAINS, `governance or contract documentation change: ${normalized}`, {
        full: true,
      });
    } else {
      add(result, ["docs"], `documentation-only change: ${normalized}`);
    }
    return;
  }

  if (normalized.startsWith("test/parity/")) {
    add(
      result,
      ["api", "web", "portal", "marketing"],
      `cross-surface parity change: ${normalized}`,
      {
        full: true,
        postgres: true,
      }
    );
    return;
  }

  if (normalized.startsWith("apps/api/")) {
    const domains = ["api"];
    if (/booking|reservation|registration|tour/.test(normalized)) domains.push("booking");
    if (/finance|payment|receipt|refund|wallet|settlement/.test(normalized))
      domains.push("finance");
    if (/ticket|waitlist/.test(normalized)) domains.push("ticketing");
    if (/auth|tenant|session|permission|rbac|security/.test(normalized)) domains.push("security");
    add(result, domains, `API change: ${normalized}`, {
      postgres:
        /(^|\/)(prisma|migrations|db|repositories|persistence)(\/|\.)|booking|reservation|finance|payment|receipt|refund|wallet|settlement|ticket|waitlist/.test(
          normalized
        ),
      security: domains.includes("security"),
    });
    return;
  }

  if (normalized.startsWith("apps/web/")) {
    const domains = ["web"];
    if (/booking|reservation|registration|tour/.test(normalized)) domains.push("booking");
    if (/finance|payment|receipt|refund|wallet|settlement/.test(normalized))
      domains.push("finance");
    if (/ticket|waitlist/.test(normalized)) domains.push("ticketing");
    if (/auth|tenant|session|permission|rbac|security/.test(normalized)) domains.push("security");
    add(result, domains, `operator web change: ${normalized}`, {
      playwright: /(^|\/)(test|e2e|playwright)(\/|\.)/.test(normalized),
      security: domains.includes("security"),
    });
    return;
  }

  if (normalized.startsWith("apps/portal/")) {
    add(result, ["portal"], `portal change: ${normalized}`, {
      playwright: /(^|\/)(test|e2e|playwright)(\/|\.)/.test(normalized),
    });
    return;
  }

  if (normalized.startsWith("apps/marketing/")) {
    add(result, ["marketing"], `marketing change: ${normalized}`, {
      playwright: /(^|\/)(test|e2e|playwright)(\/|\.)/.test(normalized),
    });
    return;
  }

  if (normalized.startsWith("packages/workspaces/denali/")) {
    add(
      result,
      ["workspace-denali", "api", "web", "portal", "marketing", "booking", "finance", "ticketing"],
      `Denali workspace change: ${normalized}`
    );
    return;
  }

  if (normalized.startsWith("packages/workspaces/")) {
    add(result, ["api", "web", "portal", "marketing"], `workspace plugin change: ${normalized}`, {
      full: true,
    });
    return;
  }

  if (/^packages\/booking-http(-contracts)?\//.test(normalized)) {
    add(
      result,
      ["api", "web", "portal", "booking"],
      `booking contract package change: ${normalized}`,
      { postgres: true }
    );
    return;
  }

  if (
    /^packages\/(workspace-sdk|platform-core|tenant-kernel|platform-events|tour-core|design-tokens|ui-primitives|theme-react|draft-engine|wizard-navigation)\//.test(
      normalized
    )
  ) {
    add(result, ALL_DOMAINS, `shared platform package change: ${normalized}`, { full: true });
    return;
  }

  if (/^packages\/(finance-|ticketing-|wallet-|engagement-|marketing-pages-)/.test(normalized)) {
    const domains = ["api", "web"];
    if (/finance|wallet/.test(normalized)) domains.push("finance");
    if (/ticketing/.test(normalized)) domains.push("ticketing");
    if (/marketing-pages/.test(normalized)) domains.push("marketing");
    add(result, domains, `domain package change: ${normalized}`, { postgres: true });
    return;
  }

  add(result, ALL_DOMAINS, `unclassified path: ${normalized}`, {
    full: true,
    unknown: true,
    path: normalized,
  });
}

export function classifyPaths(paths) {
  const result = {
    schemaVersion: 1,
    full: false,
    reasons: [],
    domains: [],
    unknownPaths: [],
    changedPaths: [...new Set(paths.map((path) => path.trim()).filter(Boolean))].sort(),
    tiers: {
      static: true,
      unit: false,
      postgres: false,
      playwright: false,
      security: false,
      full: false,
    },
  };

  for (const path of result.changedPaths) classifyPath(path, result);

  result.domains = sortedUnique(result.domains);
  result.reasons = [...new Set(result.reasons)];
  result.unknownPaths = [...new Set(result.unknownPaths)];
  result.tiers.unit = result.domains.some((domain) => domain !== "docs");
  result.tiers.full = result.full;
  if (result.full) {
    result.domains = [...ALL_DOMAINS];
    result.tiers.unit = true;
    result.tiers.postgres = true;
    result.tiers.playwright = true;
    result.tiers.security = true;
  }
  return result;
}

function gitChangedPaths(base, head) {
  const result = spawnSync("git", ["diff", "--name-only", `${base}...${head}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git diff failed for ${base}...${head}`);
  }
  return result.stdout.split("\n").filter(Boolean);
}

function parseArgs(argv) {
  const args = { base: "origin/main", head: "HEAD", filesFrom: null, githubOutput: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base") args.base = argv[++index];
    else if (argument === "--head") args.head = argv[++index];
    else if (argument === "--files-from") args.filesFrom = argv[++index];
    else if (argument === "--github-output") args.githubOutput = argv[++index];
    else if (argument === "--help") args.help = true;
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      "Usage: ci-impact.mjs [--base REF --head REF] [--files-from FILE] [--github-output FILE]"
    );
    return;
  }
  const paths = args.filesFrom
    ? readFileSync(args.filesFrom, "utf8").split("\n")
    : gitChangedPaths(args.base, args.head);
  const result = classifyPaths(paths);
  const json = JSON.stringify(result);
  console.log(json);
  if (args.githubOutput) {
    const escaped = json.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
    const output = `impact_json=${escaped}\nfull=${result.full}\ndomains=${result.domains.join(",")}\n`;
    appendFileSync(args.githubOutput, output);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
