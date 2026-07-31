#!/usr/bin/env node
/**
 * PSR-2b — fail if active authority docs link into ignored scratch.
 *
 * Scopes (hard fail):
 *   - every path listed in docs/index.yaml
 *   - docs/architecture/**
 *   - docs/standards/**
 *
 * Forbidden patterns:
 *   - markdown links to TEMP/, temp/, docs/temp/
 *   - frontmatter key related_temp:
 *
 * Allowed: prose/backticks discussing scratch dirs; supersedes: historical paths.
 *
 * Usage: node scripts/ops/psr-2b-no-temp-authority.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const INDEX = join(ROOT, "docs/index.yaml");

const LINK_RE =
  /\]\(\s*(?:\.\/|\.\.\/)*((?:TEMP|temp|docs\/temp)\/[^)\s]+)\s*\)/g;
const RELATED_RE = /^related_temp:\s*/m;

function fail(msg) {
  console.error(`psr-2b-no-temp-authority: FAIL — ${msg}`);
  process.exitCode = 1;
}

function loadIndexPaths() {
  const py = `
import json, sys, yaml
from datetime import date, datetime
def default(o):
    if isinstance(o, (date, datetime)): return o.isoformat()
    raise TypeError(type(o))
with open(sys.argv[1], encoding="utf-8") as f:
    data = yaml.safe_load(f)
json.dump(data, sys.stdout, default=default)
`;
  const r = spawnSync("python3", ["-c", py, INDEX], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    fail(`index parse: ${r.stderr}`);
    process.exit(1);
  }
  const data = JSON.parse(r.stdout);
  return (data.documents || []).map((d) => d.path);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (/\.(md|mdoc|yaml|yml)$/.test(name)) out.push(abs);
  }
  return out;
}

function main() {
  const scoped = new Set();
  for (const p of loadIndexPaths()) scoped.add(resolve(ROOT, p));
  for (const abs of walk(join(ROOT, "docs/architecture"))) scoped.add(abs);
  for (const abs of walk(join(ROOT, "docs/standards"))) scoped.add(abs);

  let checked = 0;
  for (const abs of [...scoped].sort()) {
    if (!existsSync(abs)) {
      fail(`missing scoped path ${relative(ROOT, abs)}`);
      continue;
    }
    const rel = relative(ROOT, abs);
    const text = readFileSync(abs, "utf8");
    checked += 1;
    if (RELATED_RE.test(text)) {
      fail(`${rel}: related_temp frontmatter (ignored scratch authority)`);
    }
    LINK_RE.lastIndex = 0;
    let m;
    while ((m = LINK_RE.exec(text))) {
      fail(`${rel}: markdown link into ignored scratch → ${m[1]}`);
    }
  }

  if (process.exitCode) {
    console.error("psr-2b-no-temp-authority: completed with failures");
    process.exit(process.exitCode);
  }
  console.log(
    `psr-2b-no-temp-authority: PASS (${checked} authority files; no ignored-scratch links)`,
  );
}

main();
