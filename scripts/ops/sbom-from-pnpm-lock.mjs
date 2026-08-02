#!/usr/bin/env node
/**
 * PSR-7c — Emit a minimal CycloneDX 1.5 dependency SBOM from pnpm-lock.yaml.
 * Does not require syft/cyclonedx binaries. Provenance attestations deferred.
 *
 * Usage:
 *   node scripts/ops/sbom-from-pnpm-lock.mjs [--out path]
 * Default out: reports/sbom/app-tour.cdx.json (mkdir -p)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const lockPath = join(root, "pnpm-lock.yaml");

function parseArgs(argv) {
  let out = join(root, "reports/sbom/app-tour.cdx.json");
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) {
      out = argv[++i];
      if (!out.startsWith("/")) out = join(root, out);
    }
  }
  return { out };
}

function extractPackages(lockText) {
  // pnpm lockfile v9: packages:\n  'name@version': or "name@version":
  const packagesIdx = lockText.search(/^packages:\s*$/m);
  if (packagesIdx < 0) throw new Error("pnpm-lock.yaml missing packages: section");
  const slice = lockText.slice(packagesIdx);
  const re = /^\s{2}['"]?(@?[^'"@\s]+(?:\/[^'"@\s]+)?)@([^'":\s]+)['"]?:\s*$/gm;
  const comps = new Map();
  let m;
  while ((m = re.exec(slice))) {
    const name = m[1];
    const version = m[2];
    const purl = `pkg:npm/${encodeURIComponent(name).replace(/%40/g, "@")}@${version}`;
    const bomRef = purl;
    comps.set(bomRef, {
      type: "library",
      "bom-ref": bomRef,
      name,
      version,
      purl,
    });
  }
  return [...comps.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function main() {
  const { out } = parseArgs(process.argv);
  const lockText = readFileSync(lockPath, "utf8");
  const lockHash = createHash("sha256").update(lockText).digest("hex");
  const components = extractPackages(lockText);
  const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  const doc = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: {
        components: [
          {
            type: "application",
            name: "sbom-from-pnpm-lock",
            version: "psr-7c",
          },
        ],
      },
      component: {
        type: "application",
        name: rootPkg.name || "app-tour",
        version: rootPkg.version || "0.0.0",
      },
      properties: [
        { name: "psr.wave", value: "PSR-7c-sbom-provenance-recipe" },
        { name: "psr.lockfile_sha256", value: lockHash },
        { name: "psr.generator", value: "scripts/ops/sbom-from-pnpm-lock.mjs" },
        {
          name: "psr.provenance",
          value: "not_included_pending_architect_yes",
        },
      ],
    },
    components,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

  const summary = {
    out: out.startsWith(root) ? out.slice(root.length + 1) : out,
    component_count: components.length,
    lockfile_sha256: lockHash,
    bomFormat: doc.bomFormat,
    specVersion: doc.specVersion,
  };
  console.log(`sbom-from-pnpm-lock: OK — components=${summary.component_count} out=${summary.out}`);
  if (process.argv.includes("--json-summary")) {
    console.log(JSON.stringify(summary));
  }
}

try {
  main();
} catch (err) {
  console.error(`sbom-from-pnpm-lock: ERROR — ${err.message || err}`);
  process.exit(2);
}
