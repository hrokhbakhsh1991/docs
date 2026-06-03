#!/usr/bin/env node
/**
 * Documentation Sync — registry, phase files, relative links, phase-doc sections.
 * Warns on stale MAP references; fails on missing files or broken links.
 *
 * Foundation gate (KS-01): set DOC_SYNC_SCOPE=foundation or PHASE_0_GUARD_SCOPE=foundation
 * to scan only packages/workspace-sdk, packages/config, and Phase 0 docs/audits.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");

/** Foundation doc-sync allowlist (H-02 gate isolation). */
const FOUNDATION_PACKAGE_ROOTS = ["packages/workspace-sdk", "packages/config"];

/** Repo prefixes forbidden during foundation doc-sync crawl. */
const FOUNDATION_FORBIDDEN_CRAWL_PREFIXES = [
  "apps/",
  "packages/platform-core",
  "packages/design-tokens",
  "packages/ui-primitives",
  "packages/theme-react",
  "packages/workspaces",
];

/** @typedef {{ phase: number, title: string, doc: string, mapSection?: string, requiredDocSections?: string[] }} PhaseEntry */

function isFoundationDocSyncScope() {
  const docSync = (process.env.DOC_SYNC_SCOPE ?? "").trim().toLowerCase();
  const phase0Guard = (process.env.PHASE_0_GUARD_SCOPE ?? "").trim().toLowerCase();
  return docSync === "foundation" || phase0Guard === "foundation";
}

function readRegistry() {
  const registryPath = path.join(DOCS_DIR, "phase-registry.json");
  if (!fs.existsSync(registryPath)) {
    throw new Error("missing docs/phase-registry.json");
  }
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

/**
 * @param {string} sourcePath absolute path to markdown file
 * @param {string} link target from markdown ](...)
 */
function resolveDocLink(sourcePath, link) {
  const trimmed = link.trim();
  if (/^(https?:|mailto:|#)/i.test(trimmed)) return { ok: true, external: true };
  const withoutHash = trimmed.split("#")[0];
  if (withoutHash.length === 0) return { ok: true, anchorOnly: true };
  if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/i.test(withoutHash)) {
    return { ok: true, sourceCodeRef: true };
  }

  const baseDir = path.dirname(sourcePath);
  let resolved = path.resolve(baseDir, withoutHash);
  if (!fs.existsSync(resolved) && !withoutHash.endsWith(".md") && !withoutHash.endsWith(".mdoc")) {
    resolved = `${resolved}.md`;
  }
  if (!fs.existsSync(resolved) && fs.existsSync(`${resolved}.md`)) {
    resolved = `${resolved}.md`;
  }
  if (!fs.existsSync(resolved) && fs.existsSync(`${resolved}.mdoc`)) {
    resolved = `${resolved}.mdoc`;
  }
  return { ok: fs.existsSync(resolved), resolved };
}

function phasesForDocSync(registry) {
  if (isFoundationDocSyncScope()) {
    return registry.phases.filter((p) => p.phase === 0);
  }
  const required = registry.zeroDebtDocSync?.phasesRequired;
  if (Array.isArray(required) && required.length > 0) {
    return registry.phases.filter((p) => required.includes(p.phase));
  }
  return registry.phases;
}

function auditsForDocSync(registry) {
  if (isFoundationDocSyncScope()) {
    return (registry.audits ?? []).filter((a) => a.phase === 0);
  }
  return registry.audits ?? [];
}

/** @param {string} pkgRel */
function assertFoundationPackageAllowed(pkgRel) {
  const normalized = pkgRel.replace(/\\/g, "/");
  for (const forbidden of FOUNDATION_FORBIDDEN_CRAWL_PREFIXES) {
    if (normalized === forbidden.replace(/\/$/, "") || normalized.startsWith(forbidden)) {
      throw new Error(
        `documentation-sync: foundation scope must not crawl ${pkgRel} (forbidden prefix ${forbidden})`,
      );
    }
  }
  if (!FOUNDATION_PACKAGE_ROOTS.includes(normalized)) {
    throw new Error(
      `documentation-sync: foundation scope package not allowlisted: ${pkgRel} (allowed: ${FOUNDATION_PACKAGE_ROOTS.join(", ")})`,
    );
  }
}

function checkPackageReadmes(registry, phasesToCheck) {
  /** @type {string[]} */
  const errors = [];
  const foundationScope = isFoundationDocSyncScope();

  for (const phase of phasesToCheck) {
    for (const pkgRel of phase.packages ?? []) {
      if (foundationScope) {
        assertFoundationPackageAllowed(pkgRel);
      }

      const readmePath = path.join(REPO_ROOT, pkgRel, "README.md");
      if (!fs.existsSync(readmePath)) {
        errors.push(`missing package README: ${pkgRel}/README.md (phase ${phase.phase})`);
        continue;
      }
      const body = fs.readFileSync(readmePath, "utf8");
      if (!body.includes("MIGRATION-MAP.md")) {
        errors.push(`${pkgRel}/README.md: must link to docs/MIGRATION-MAP.md`);
      }
      const phaseDoc = phase.doc ?? phase.markdocDoc;
      const mustLink = phase.packageReadmeMustLink ?? phaseDoc;
      const altExt = mustLink?.endsWith(".mdoc")
        ? mustLink.replace(/\.mdoc$/, ".md")
        : mustLink?.endsWith(".md")
          ? mustLink.replace(/\.md$/, ".mdoc")
          : null;
      if (
        mustLink &&
        !body.includes(mustLink) &&
        !(altExt && body.includes(altExt))
      ) {
        errors.push(`${pkgRel}/README.md: must link to ${mustLink}`);
      }
    }
  }
  return errors;
}

function extractMarkdownLinks(content) {
  const links = [];
  const linkRe = /\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRe.exec(content)) !== null) {
    links.push(m[1]);
  }
  return links;
}

function checkPhaseFiles(registry, phasesToCheck, auditsToCheck) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  for (const phase of phasesToCheck) {
    const docPath = path.join(DOCS_DIR, phase.doc);
    if (!fs.existsSync(docPath)) {
      errors.push(`missing phase doc: ${phase.doc}`);
      continue;
    }
    if (phase.mapSection) {
      const map = fs.readFileSync(path.join(DOCS_DIR, "MIGRATION-MAP.md"), "utf8");
      if (!map.includes(phase.mapSection)) {
        warnings.push(
          `stale registry: phase ${phase.phase} mapSection "${phase.mapSection}" not found in MIGRATION-MAP.md`,
        );
      }
    }
    if (phase.requiredDocSections?.length) {
      const body = fs.readFileSync(docPath, "utf8");
      for (const section of phase.requiredDocSections) {
        if (!body.includes(section)) {
          errors.push(`${phase.doc}: missing required section marker "${section}"`);
        }
      }
    }
  }

  for (const audit of auditsToCheck) {
    const auditPath = path.join(DOCS_DIR, audit.doc);
    if (!fs.existsSync(auditPath)) {
      errors.push(`missing audit: ${audit.doc}`);
    }
  }

  return { errors, warnings };
}

function linkScanFiles(phasesToCheck, auditsToCheck) {
  if (isFoundationDocSyncScope()) {
    return [
      path.join(DOCS_DIR, "MIGRATION-MAP.md"),
      path.join(DOCS_DIR, "README.md"),
      ...phasesToCheck.map((p) => path.join(DOCS_DIR, p.doc)),
      ...auditsToCheck.map((a) => path.join(DOCS_DIR, a.doc)),
    ];
  }

  return [
    path.join(DOCS_DIR, "MIGRATION-MAP.md"),
    path.join(DOCS_DIR, "README.md"),
    path.join(DOCS_DIR, "DOCUMENTATION-DEBT-REGISTRY.md"),
    ...phasesToCheck.map((p) => path.join(DOCS_DIR, p.doc)),
    ...auditsToCheck.map((a) => path.join(DOCS_DIR, a.doc)),
    path.join(DOCS_DIR, "audits/README.md"),
    path.join(DOCS_DIR, "phases/README.md"),
  ];
}

function checkLinksInFile(filePath) {
  /** @type {string[]} */
  const errors = [];
  const content = fs.readFileSync(filePath, "utf8");
  const relFile = path.relative(REPO_ROOT, filePath);

  for (const link of extractMarkdownLinks(content)) {
    const result = resolveDocLink(filePath, link);
    if (result.external || result.anchorOnly || result.sourceCodeRef) continue;
    if (!result.ok) {
      errors.push(`${relFile}: broken link → ${link}`);
    }
  }
  return errors;
}

function main() {
  const registry = readRegistry();
  const foundationScope = isFoundationDocSyncScope();
  const phasesToCheck = phasesForDocSync(registry);
  const auditsToCheck = auditsForDocSync(registry);

  const { errors: phaseErrors, warnings } = checkPhaseFiles(
    registry,
    phasesToCheck,
    auditsToCheck,
  );
  const packageErrors = checkPackageReadmes(registry, phasesToCheck);

  /** @type {string[]} */
  const linkErrors = [];
  const scanFiles = linkScanFiles(phasesToCheck, auditsToCheck);

  for (const file of scanFiles) {
    if (fs.existsSync(file)) {
      linkErrors.push(...checkLinksInFile(file));
    }
  }

  for (const w of warnings) {
    console.warn(`documentation-sync: WARN — ${w}`);
  }

  const errors = [...phaseErrors, ...packageErrors, ...linkErrors];
  if (errors.length > 0) {
    console.error(
      foundationScope
        ? "documentation-sync: FAIL (scope: foundation)"
        : "documentation-sync: FAIL",
    );
    for (const e of errors) {
      console.error(`  ✗ ${e}`);
    }
    process.exit(1);
  }

  const pkgCount = phasesToCheck.reduce((n, p) => n + (p.packages?.length ?? 0), 0);
  if (foundationScope) {
    console.log("documentation-sync: PASS (scope: foundation)");
    console.log(`  phases checked: ${phasesToCheck.map((p) => p.phase).join(", ")}`);
    console.log(`  audits checked: ${auditsToCheck.length}`);
    console.log(`  package READMEs: ${pkgCount} (${FOUNDATION_PACKAGE_ROOTS.join(", ")})`);
    console.log(`  link scan files: ${scanFiles.length}`);
    return;
  }

  console.log("documentation-sync: PASS");
  console.log(`  phases: ${registry.phases.length}`);
  console.log(`  audits: ${(registry.audits ?? []).length}`);
  console.log(`  package READMEs: ${pkgCount}`);
}

main();
