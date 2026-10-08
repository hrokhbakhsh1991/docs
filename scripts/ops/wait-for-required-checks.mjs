#!/usr/bin/env node
/**
 * MR-P0-004 — block deploy until MAIN_BRANCH_REQUIRED_CHECKS are successful on this SHA.
 * Uses GitHub Checks API (GITHUB_TOKEN in Actions) or `gh` locally.
 *
 * Env:
 *   GITHUB_REPOSITORY  owner/repo (Actions default)
 *   GITHUB_SHA         commit to inspect (Actions default)
 *   GH_TOKEN / GITHUB_TOKEN
 *   WAIT_CHECKS_TIMEOUT_SEC  default 7500 (125m; longer than the 120m L3 gate)
 *   WAIT_CHECKS_POLL_SEC     default 30
 *   WAIT_CHECKS_API_RETRIES  default 5 (transient GitHub API failures)
 *
 * @see scripts/ops/main-branch-required-checks.mjs
 * @see docs/phase-20/p7/appendices/BOOKING_BRANCH_PROTECTION_GATE.md
 */
import { MAIN_BRANCH_REQUIRED_CHECKS } from "./main-branch-required-checks.mjs";

const repo = process.env.GITHUB_REPOSITORY?.trim();
const sha = (process.env.GITHUB_SHA || process.env.GITHUB_HEAD_SHA || "").trim();
const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
const timeoutSec = Number(process.env.WAIT_CHECKS_TIMEOUT_SEC || "7500");
const pollSec = Number(process.env.WAIT_CHECKS_POLL_SEC || "30");
const apiRetries = Number(process.env.WAIT_CHECKS_API_RETRIES || "5");

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
  for (let attempt = 0; attempt <= apiRetries; attempt += 1) {
    let res;
    try {
      res = await fetch(`https://api.github.com${pathname}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "app-cloud-wait-required-checks",
        },
      });
    } catch (error) {
      if (attempt === apiRetries) throw error;
      const delaySec = Math.min(30, 2 ** attempt);
      console.warn(
        `[wait-checks] transient GitHub network error; retry ${attempt + 1}/${apiRetries} in ${delaySec}s`,
      );
      await sleep(delaySec * 1000);
      continue;
    }

    if (res.ok) return res.json();

    const body = await res.text();
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt === apiRetries) {
      throw new Error(`GitHub API ${res.status} ${pathname}: ${body.slice(0, 400)}`);
    }

    const retryAfter = Number(res.headers.get("retry-after"));
    const delaySec = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter
      : Math.min(30, 2 ** attempt);
    console.warn(
      `[wait-checks] transient GitHub API ${res.status}; retry ${attempt + 1}/${apiRetries} in ${delaySec}s`,
    );
    await sleep(delaySec * 1000);
  }
  throw new Error(`GitHub API request exhausted retries: ${pathname}`);
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
      const entry = { state: run.status, conclusion: run.conclusion };
      const current = map.get(run.name);

      // A workflow can publish duplicate check names on the same SHA (for
      // example, a real booking gate plus a path-filtered skipped job). Keep
      // a successful run authoritative instead of letting a later skipped
      // record overwrite it and block deployment indefinitely.
      if (!current || entry.conclusion === "success" || current.conclusion !== "success") {
        map.set(run.name, entry);
      }
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
  if (pending.length) console.log(`[wait-checks] pending: ${pending.join(", ")}`);
  if (missing.length) console.log(`[wait-checks] missing: ${missing.join(", ")}`);

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
