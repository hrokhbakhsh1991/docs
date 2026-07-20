#!/usr/bin/env node
/**
 * MR-P0-004 — block deploy until MAIN_BRANCH_REQUIRED_CHECKS are successful on this SHA.
 * Uses GitHub Checks API (GITHUB_TOKEN in Actions) or `gh` locally.
 *
 * Env:
 *   GITHUB_REPOSITORY  owner/repo (Actions default)
 *   GITHUB_SHA         commit to inspect (Actions default)
 *   GH_TOKEN / GITHUB_TOKEN
 *   WAIT_CHECKS_TIMEOUT_SEC  default 2400 (40m)
 *   WAIT_CHECKS_POLL_SEC     default 30
 *
 * @see scripts/ops/main-branch-required-checks.mjs
 * @see docs/phase-20/p7/appendices/BOOKING_BRANCH_PROTECTION_GATE.md
 */
import { MAIN_BRANCH_REQUIRED_CHECKS } from "./main-branch-required-checks.mjs";

const repo = process.env.GITHUB_REPOSITORY?.trim();
const sha = (process.env.GITHUB_SHA || process.env.GITHUB_HEAD_SHA || "").trim();
const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
const timeoutSec = Number(process.env.WAIT_CHECKS_TIMEOUT_SEC || "2400");
const pollSec = Number(process.env.WAIT_CHECKS_POLL_SEC || "30");

if (!repo || !sha) {
  console.error("ERROR: GITHUB_REPOSITORY and GITHUB_SHA are required");
  process.exit(1);
}
if (!token) {
  console.error("ERROR: GH_TOKEN or GITHUB_TOKEN is required");
  process.exit(1);
}

const [owner, name] = repo.split("/");
if (!owner || !name) {
  console.error(`ERROR: invalid GITHUB_REPOSITORY: ${repo}`);
  process.exit(1);
}

const required = [...MAIN_BRANCH_REQUIRED_CHECKS];

async function gh(pathname) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "app-cloud-wait-required-checks",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status} ${pathname}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

/** @returns {Map<string, { state: string, conclusion: string | null }>} */
async function loadCheckMap() {
  /** @type {Map<string, { state: string, conclusion: string | null }>} */
  const map = new Map();

  // Check runs (Actions jobs)
  let page = 1;
  for (;;) {
    const data = await gh(
      `/repos/${owner}/${name}/commits/${sha}/check-runs?per_page=100&page=${page}`
    );
    for (const run of data.check_runs ?? []) {
      map.set(run.name, { state: run.status, conclusion: run.conclusion });
    }
    if ((data.check_runs?.length ?? 0) < 100) break;
    page += 1;
    if (page > 20) break;
  }

  // Legacy statuses (some gates may still publish)
  page = 1;
  for (;;) {
    const data = await gh(
      `/repos/${owner}/${name}/commits/${sha}/status?per_page=100&page=${page}`
    );
    for (const st of data.statuses ?? []) {
      if (!map.has(st.context)) {
        const conclusion =
          st.state === "success"
            ? "success"
            : st.state === "failure" || st.state === "error"
              ? "failure"
              : null;
        map.set(st.context, {
          state: st.state === "pending" ? "in_progress" : "completed",
          conclusion,
        });
      }
    }
    if ((data.statuses?.length ?? 0) < 100) break;
    page += 1;
    if (page > 20) break;
  }

  return map;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const deadline = Date.now() + timeoutSec * 1000;

console.log(`Waiting for ${required.length} required checks on ${sha} (${repo})`);
for (const c of required) console.log(`  - ${c}`);

while (Date.now() < deadline) {
  const map = await loadCheckMap();
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const pending = [];
  /** @type {string[]} */
  const failed = [];
  /** @type {string[]} */
  const passed = [];

  for (const name of required) {
    const entry = map.get(name);
    if (!entry) {
      missing.push(name);
      continue;
    }
    if (entry.state !== "completed") {
      pending.push(name);
      continue;
    }
    if (entry.conclusion === "success" || entry.conclusion === "neutral" || entry.conclusion === "skipped") {
      // Neutral/skipped are not success for release gates — treat as fail for booking/phase.
      if (entry.conclusion === "success") {
        passed.push(name);
      } else {
        failed.push(`${name} (${entry.conclusion})`);
      }
      continue;
    }
    failed.push(`${name} (${entry.conclusion ?? "unknown"})`);
  }

  console.log(
    `[wait-checks] passed=${passed.length}/${required.length} pending=${pending.length} missing=${missing.length} failed=${failed.length}`
  );

  if (failed.length) {
    console.error("ERROR: required check(s) failed:");
    for (const f of failed) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  if (missing.length === 0 && pending.length === 0 && passed.length === required.length) {
    console.log("OK: all required release checks succeeded.");
    process.exit(0);
  }

  await sleep(pollSec * 1000);
}

console.error(`ERROR: timed out after ${timeoutSec}s waiting for required checks`);
process.exit(1);
