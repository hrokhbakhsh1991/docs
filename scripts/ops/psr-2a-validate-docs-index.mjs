#!/usr/bin/env node
/**
 * PSR-2a — validate docs/index.yaml against DOC-META-001 (ops only).
 *
 * Usage: node scripts/ops/psr-2a-validate-docs-index.mjs
 *
 * Uses Python PyYAML (available in this environment) to avoid adding a root
 * dependency. Does not register a public package.json script (PSR-3 rule).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const INDEX = join(ROOT, "docs/index.yaml");
const ALLOWED_ROLES = new Set([
  "canonical",
  "standard",
  "adr",
  "runbook",
  "audit_snapshot",
  "evidence",
  "archive",
]);
const ALLOWED_STATUS = new Set(["active", "draft", "deprecated", "archived"]);
const REQUIRED = [
  "id",
  "role",
  "owner",
  "status",
  "last_verified",
  "verified_sha",
  "supersedes",
  "superseded_by",
  "evidence",
];

function fail(msg) {
  console.error(`psr-2a-validate-docs-index: FAIL — ${msg}`);
  process.exitCode = 1;
}

function loadIndex() {
  if (!existsSync(INDEX)) {
    fail(`missing ${INDEX}`);
    process.exit(1);
  }
  const py = `
import json, sys, yaml
from datetime import date, datetime

def default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))

with open(sys.argv[1], encoding="utf-8") as f:
    data = yaml.safe_load(f)
json.dump(data, sys.stdout, default=default)
`;
  const r = spawnSync("python3", ["-c", py, INDEX], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) {
    fail(`yaml parse: ${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}

function parseFrontmatter(absPath) {
  const text = readFileSync(absPath, "utf8");
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) {
    return null;
  }
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const raw = text.slice(4, end);
  const py = `
import json, sys, yaml
from datetime import date, datetime

def default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))

data = yaml.safe_load(sys.stdin.read()) or {}
json.dump(data, sys.stdout, default=default)
`;
  const r = spawnSync("python3", ["-c", py], {
    cwd: ROOT,
    input: raw,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`frontmatter parse ${absPath}: ${r.stderr}`);
  }
  return JSON.parse(r.stdout);
}

function asList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function main() {
  const index = loadIndex();
  if (index.schema_version !== 1) fail("schema_version must be 1");
  if (!Array.isArray(index.documents) || index.documents.length === 0) {
    fail("documents must be a non-empty array");
  }

  const ids = new Set();
  const paths = new Set();

  for (const doc of index.documents) {
    for (const k of REQUIRED) {
      if (!(k in doc)) fail(`${doc.id || doc.path}: missing index field ${k}`);
    }
    if (!doc.id || !doc.path) {
      fail("document missing id or path");
      continue;
    }
    if (ids.has(doc.id)) fail(`duplicate id ${doc.id}`);
    ids.add(doc.id);
    if (paths.has(doc.path)) fail(`duplicate path ${doc.path}`);
    paths.add(doc.path);

    if (!ALLOWED_ROLES.has(doc.role)) fail(`${doc.id}: invalid role ${doc.role}`);
    if (!ALLOWED_STATUS.has(doc.status)) {
      fail(`${doc.id}: invalid status ${doc.status}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(doc.last_verified))) {
      fail(`${doc.id}: last_verified must be YYYY-MM-DD`);
    }
    if (!doc.verified_sha) fail(`${doc.id}: verified_sha empty`);
    if (!Array.isArray(doc.supersedes)) fail(`${doc.id}: supersedes must be array`);
    if (!Array.isArray(doc.evidence)) fail(`${doc.id}: evidence must be array`);

    const abs = join(ROOT, doc.path);
    if (!existsSync(abs)) fail(`${doc.id}: path missing on disk: ${doc.path}`);

    if (doc.frontmatter === "none") continue;
    if (!doc.path.endsWith(".mdoc") && !doc.path.endsWith(".md")) continue;

    let fm;
    try {
      fm = parseFrontmatter(abs);
    } catch (e) {
      fail(String(e.message || e));
      continue;
    }
    if (!fm) {
      fail(`${doc.id}: missing YAML frontmatter`);
      continue;
    }

    // role wins over legacy doc_role
    const role = fm.role || null;
    if (!role) fail(`${doc.id}: frontmatter missing role`);
    else if (role !== doc.role) {
      fail(`${doc.id}: frontmatter role=${role} != index role=${doc.role}`);
    }

    for (const k of ["id", "owner", "status", "last_verified", "verified_sha"]) {
      if (fm[k] == null || fm[k] === "") {
        fail(`${doc.id}: frontmatter missing ${k}`);
      } else if (String(fm[k]) !== String(doc[k]) && k !== "verified_sha") {
        // verified_sha may be short in one place — allow prefix match
        fail(`${doc.id}: frontmatter ${k}=${fm[k]} != index ${doc[k]}`);
      } else if (k === "verified_sha") {
        const a = String(fm[k]);
        const b = String(doc[k]);
        if (!(a === b || a.startsWith(b) || b.startsWith(a))) {
          fail(`${doc.id}: verified_sha mismatch frontmatter=${a} index=${b}`);
        }
      }
    }

    if (!("supersedes" in fm)) fail(`${doc.id}: frontmatter missing supersedes`);
    if (!("superseded_by" in fm)) {
      fail(`${doc.id}: frontmatter missing superseded_by`);
    }
    if (!("evidence" in fm)) fail(`${doc.id}: frontmatter missing evidence`);

    if (fm.doc_role && fm.role && fm.doc_role !== fm.role) {
      // legacy alias allowed only if mapped intentionally; warn via note
      // not a hard fail during PSR-2a if role is present
    }
  }

  // evidence paths referenced should exist when listed
  for (const doc of index.documents) {
    for (const ev of asList(doc.evidence)) {
      if (!existsSync(join(ROOT, ev))) {
        fail(`${doc.id}: evidence missing ${ev}`);
      }
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error("psr-2a-validate-docs-index: completed with failures");
    process.exit(process.exitCode);
  }
  console.log(
    `psr-2a-validate-docs-index: PASS (${index.documents.length} documents)`,
  );
}

main();
