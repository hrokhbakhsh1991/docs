/**
 * Parse apps/{web,api}/tests|test/OWNERS.md and resolve centralized tests for staged src changes.
 *
 * OWNERS.md contains a ```owners YAML block (see file headers for schema).
 */
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} globPattern e.g. `src/modules/auth/**` (relative to app root)
 * @param {string} relPath file path relative to app root, forward slashes
 */
export function globMatches(globPattern, relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  let re = globPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "{{GLOBSTAR_SLASH}}")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR_SLASH\}\}/g, "(?:.*/)?")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*")
    .replace(/\?/g, "[^/]");
  if (!re.startsWith("(?:.*/)?") && !re.includes("/")) {
    re = `(?:.*/)?${re}`;
  }
  return new RegExp(`^${re}$`).test(normalized);
}

/**
 * @param {string} markdown
 * @returns {{ app: string, testDir: string, srcRoot: string, owners: object[] }}
 */
export function parseOwnersMarkdown(markdown) {
  const fence = markdown.match(/```owners\s*\n([\s\S]*?)```/);
  if (!fence) {
    throw new Error("OWNERS.md: missing ```owners fenced YAML block");
  }
  const yaml = fence[1];
  return parseOwnersYaml(yaml);
}

/** Minimal YAML parser for our constrained OWNERS schema. */
function parseOwnersYaml(yaml) {
  /** @type {Record<string, unknown>} */
  const root = { owners: [] };
  /** @type {Record<string, unknown> | null} */
  let current = null;
  /** @type {string | null} */
  let listKey = null;

  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.replace(/\s+#.*$/, "").trimEnd();
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const ownerStart = line.match(/^\s{2}-\s+module:\s*(.+)$/);
    if (ownerStart) {
      current = {
        module: unquote(ownerStart[1].trim()),
        src: [],
        tests: [],
        precommit: true,
        runner: "node",
      };
      /** @type {object[]} */ (root.owners).push(current);
      listKey = null;
      continue;
    }

    const kv = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kv) {
      const [, indent, key, value] = kv;
      const depth = indent.length;

      if (depth === 0) {
        listKey = null;
        current = null;
        if (key === "owners" && !value) continue;
        root[key] = unquote(value);
        continue;
      }

      if (depth === 4 && current) {
        if (!value) {
          listKey = key;
          if (!Array.isArray(current[key])) current[key] = [];
        } else if (key === "precommit" || key === "preCommit") {
          current.precommit = value === "true";
        } else if (key === "runner") {
          current.runner = unquote(value);
        } else {
          current[key] = unquote(value);
        }
        continue;
      }
    }

    const listItem = line.match(/^\s{6}-\s+(.*)$/);
    if (listItem && listKey && current) {
      const val = unquote(listItem[1].trim());
      const arr = /** @type {string[]} */ (current[listKey]);
      arr.push(val);
    }
  }

  return {
    app: String(root.app ?? ""),
    testDir: String(root.testDir ?? "test"),
    srcRoot: String(root.srcRoot ?? "src"),
    owners: /** @type {object[]} */ (root.owners),
  };
}

function unquote(s) {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * @param {string} repoRoot
 * @param {"web" | "api"} app
 */
export function loadAppOwners(repoRoot, app) {
  const appRoot = path.join(repoRoot, "apps", app);
  const ownersPath =
    app === "web"
      ? path.join(appRoot, "tests", "OWNERS.md")
      : path.join(appRoot, "test", "OWNERS.md");
  const markdown = fs.readFileSync(ownersPath, "utf8");
  const parsed = parseOwnersMarkdown(markdown);
  return { ...parsed, app, appRoot, ownersPath };
}

/**
 * @param {string} repoRoot
 */
export function loadAllOwners(repoRoot) {
  return {
    web: loadAppOwners(repoRoot, "web"),
    api: loadAppOwners(repoRoot, "api"),
  };
}

/**
 * @param {string} stagedRel repo-relative staged path (forward slashes)
 * @param {ReturnType<typeof loadAppOwners>} ownersDoc
 * @returns {string[]} repo-relative test paths
 */
export function centralizedTestsForSource(stagedRel, ownersDoc) {
  const rel = stagedRel.replace(/\\/g, "/");
  const prefix = `apps/${ownersDoc.app}/`;
  if (!rel.startsWith(prefix)) return [];

  const relToApp = rel.slice(prefix.length);
  if (!relToApp || relToApp.startsWith("tests/") || relToApp.startsWith("test/")) return [];
  /** @type {Set<string>} */
  const tests = new Set();

  for (const entry of ownersDoc.owners) {
    const srcGlobs = /** @type {string[]} */ (entry.src ?? []);
    if (!srcGlobs.some((g) => globMatches(g, relToApp))) continue;

    const testGlobs = /** @type {string[]} */ (entry.tests ?? []);
    const testDirAbs = path.join(ownersDoc.appRoot, ownersDoc.testDir);
    for (const testGlob of testGlobs) {
      resolveTestGlob(testDirAbs, ownersDoc.testDir, testGlob, tests);
    }
  }

  return [...tests].map((t) =>
    path.posix.join(`apps/${ownersDoc.app}`, ownersDoc.testDir, t),
  );
}

function resolveTestGlob(testDirAbs, testDirRel, globPattern, out) {
  const _absPattern = path.join(testDirAbs, globPattern);
  if (globPattern.includes("*")) {
    const base = globPattern.split("*")[0].replace(/\/$/, "");
    const dir = path.join(testDirAbs, base);
    if (!fs.existsSync(dir)) return;
    walkTestTree(dir, testDirAbs, globPattern, out);
    return;
  }
  const _rel = path.join(testDirRel, globPattern).replace(/\\/g, "/");
  const abs = path.join(testDirAbs, globPattern);
  if (fs.existsSync(abs) && isTestFile(abs)) {
    out.add(globPattern.replace(/\\/g, "/"));
  }
}

function walkTestTree(dir, testDirAbs, globPattern, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTestTree(abs, testDirAbs, globPattern, out);
      continue;
    }
    if (!isTestFile(abs)) continue;
    const relToTestDir = path.relative(testDirAbs, abs).replace(/\\/g, "/");
    if (globMatches(globPattern, relToTestDir)) {
      out.add(relToTestDir);
    }
  }
}

function isTestFile(p) {
  return /\.(spec|test|unit-spec|integration-spec|e2e-spec)\.(ts|tsx|js|jsx)$/i.test(p);
}

/**
 * @param {string} repoRoot
 * @param {string[]} stagedRelPaths repo-relative
 * @param {{ precommitOnly?: boolean }} [opts]
 */
export function centralizedTestsForStaged(repoRoot, stagedRelPaths, opts = {}) {
  const all = loadAllOwners(repoRoot);
  /** @type {Map<string, { path: string, runner: string, precommit: boolean }>} */
  const byPath = new Map();

  for (const staged of stagedRelPaths) {
    for (const doc of [all.web, all.api]) {
      const rel = staged.replace(/\\/g, "/");
      const tests = centralizedTestsForSource(rel, doc);
      for (const testPath of tests) {
        const entry = findOwnerEntryForTest(doc, testPath);
        const precommit = entry?.precommit !== false;
        const runner = entry?.runner ?? "node";
        if (opts.precommitOnly && !precommit) continue;
        byPath.set(testPath, { path: testPath, runner, precommit });
      }
    }
  }

  return [...byPath.values()];
}

function findOwnerEntryForTest(doc, repoTestPath) {
  const prefix = `apps/${doc.app}/${doc.testDir}/`;
  if (!repoTestPath.startsWith(prefix)) return null;
  const relTest = repoTestPath.slice(prefix.length);
  for (const entry of doc.owners) {
    const tests = /** @type {string[]} */ (entry.tests ?? []);
    if (tests.some((g) => globMatches(g, relTest))) return entry;
  }
  return null;
}

/**
 * @param {string} repoRoot
 * @param {string[]} stagedRelPaths
 */
export function precommitCentralizedNodeTests(repoRoot, stagedRelPaths) {
  return centralizedTestsForStaged(repoRoot, stagedRelPaths, { precommitOnly: true })
    .filter((t) => t.runner === "node")
    .map((t) => t.path)
    .filter(
      (p) =>
        !/\/e2e\//.test(p) &&
        !/\.e2e-spec\.(ts|tsx)$/.test(p) &&
        !/\/api\.e2e-spec/.test(p),
    );
}
