#!/usr/bin/env node
/**
 * PSR-7b — High-confidence secret scan over `git ls-files` (tracked tip only).
 * No history. No gitleaks binary required.
 *
 * Connection-string / env-assignment entropy sweeps are deferred to a YES
 * gitleaks history pack — local CI uses intentional app_tour:app_tour fixtures.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const allowlistPath = join(root, "scripts/ops/secret-scan-tracked-allowlist.yaml");

const BINARY_EXT =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|eot|mp4|webm|wasm|node)$/i;

const FAMILIES = [
  {
    id: "private_key",
    /**
     * PEM header present AND body does not look like an obvious placeholder.
     */
    match(text) {
      const re = /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----([\s\S]{0,800}?)-----END (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g;
      let m;
      while ((m = re.exec(text))) {
        const body = m[1] || "";
        if (/REPLACE|YOUR_|EXAMPLE|\.\.\.|changeme|placeholder|insert[_-]?key/i.test(body)) {
          continue;
        }
        // Require some base64-looking content (not empty / ellipsis-only)
        const compact = body.replace(/\\n|\s+/g, "");
        if (compact.length < 40) continue;
        if (!/^[A-Za-z0-9+/]+=*$/.test(compact.slice(0, 64))) continue;
        return true;
      }
      // Header-only without END still suspicious if followed by long base64 line
      if (/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----\s*[A-Za-z0-9+/]{40,}/.test(text)) {
        if (!/REPLACE|YOUR_|EXAMPLE|\.\.\.|changeme|placeholder/i.test(text)) return true;
      }
      return false;
    },
  },
  {
    id: "aws_access_key",
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: "github_pat",
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/,
  },
  {
    id: "slack_token",
    re: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  },
  {
    id: "stripe_live_key",
    re: /\bsk_live_[A-Za-z0-9]{20,}\b/,
  },
];

function loadYaml(abs) {
  const py = `
import json, sys, yaml
from datetime import date, datetime
def default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))
with open(sys.argv[1], encoding="utf-8") as f:
    json.dump(yaml.safe_load(f), sys.stdout, default=default)
`;
  const r = spawnSync("python3", ["-c", py, abs], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "yaml failed");
  return JSON.parse(r.stdout);
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\0")
    .replace(/\*/g, "[^/]*")
    .replace(/\0/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function buildAllowMatchers(entries) {
  return (entries || []).map((e) => {
    if (e.path) {
      return {
        test: (p) => p === e.path,
        families: new Set(e.families || []),
        label: e.path,
      };
    }
    if (e.path_glob) {
      const re = globToRegExp(e.path_glob);
      return {
        test: (p) => re.test(p),
        families: new Set(e.families || []),
        label: e.path_glob,
      };
    }
    throw new Error("allowlist entry needs path or path_glob");
  });
}

function isAllowed(matchers, relPath, familyId) {
  for (const m of matchers) {
    if (!m.test(relPath)) continue;
    if (m.families.size === 0 || m.families.has(familyId)) return m;
  }
  return null;
}

function listTracked() {
  const r = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr?.toString() || "git ls-files failed");
  }
  return r.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((p) => !BINARY_EXT.test(p))
    .filter((p) => !p.startsWith("node_modules/"));
}

function familyHits(fam, text) {
  if (typeof fam.match === "function") return fam.match(text);
  fam.re.lastIndex = 0;
  return fam.re.test(text);
}

function scanFile(relPath, matchers) {
  const abs = join(root, relPath);
  if (!existsSync(abs)) return [];
  let text;
  try {
    const buf = readFileSync(abs);
    if (buf.includes(0)) return [];
    text = buf.toString("utf8");
  } catch {
    return [];
  }
  if (text.length > 2_000_000) return [];

  const hits = [];
  for (const fam of FAMILIES) {
    if (!familyHits(fam, text)) continue;
    const allow = isAllowed(matchers, relPath, fam.id);
    hits.push({
      path: relPath,
      family: fam.id,
      allowlisted: Boolean(allow),
      allow_label: allow?.label || null,
    });
  }
  return hits;
}

function main() {
  const jsonMode = process.argv.includes("--json");
  const allow = loadYaml(allowlistPath);
  const matchers = buildAllowMatchers(allow.entries || []);
  const files = listTracked();
  const allHits = [];
  for (const f of files) allHits.push(...scanFile(f, matchers));
  const open = allHits.filter((h) => !h.allowlisted);
  const allowed = allHits.filter((h) => h.allowlisted);

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          tracked_files_scanned: files.length,
          families: FAMILIES.map((f) => f.id),
          hit_count: allHits.length,
          open_count: open.length,
          allowlisted_count: allowed.length,
          open,
          allowlisted: allowed,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `secret-scan-tracked-baseline: scanned=${files.length} open=${open.length} allowlisted=${allowed.length}`,
    );
    for (const h of open) console.error(`  OPEN ${h.family} ${h.path}`);
    for (const h of allowed) {
      console.log(`  allow ${h.family} ${h.path} (${h.allow_label})`);
    }
  }

  if (open.length > 0) process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(`secret-scan-tracked-baseline: ERROR — ${err.message || err}`);
  process.exit(2);
}
