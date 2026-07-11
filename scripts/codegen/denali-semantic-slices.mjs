/**
 * Composes Denali DTCG workspace slices from theme/shared/ layer files.
 * @see docs/workspaces/denali/unified-semantic-token-schema.mdoc
 *
 * Usage:
 *   node scripts/codegen/denali-semantic-slices.mjs
 *   node scripts/codegen/denali-semantic-slices.mjs --check
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED_DIR = path.join(
  REPO_ROOT,
  "packages/workspaces/denali/theme/shared",
);
const COMPOSE_MANIFEST = path.join(SHARED_DIR, "compose.manifest.json");
const DTCG_OUT_DIR = path.join(REPO_ROOT, "packages/design-tokens/dtcg/workspaces");

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function isPlainObject(a) {
  return typeof a === "object" && a !== null && !Array.isArray(a);
}

/**
 * Deep-merge DTCG token group objects (palette, color, flat, mkt, denali, …).
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 */
export function mergeTokenGroups(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      mergeTokenGroups(target[key], value);
      continue;
    }
    target[key] = structuredClone(value);
  }
  return target;
}

/**
 * @param {string} relativePath
 */
function readSharedLayer(relativePath) {
  const abs = path.join(SHARED_DIR, relativePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`DENALI_SEMANTIC_LAYER_MISSING:${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

/**
 * @param {string[]} mergePaths
 */
export function mergeSharedLayers(mergePaths) {
  /** @type {Record<string, unknown>} */
  const merged = {};
  for (const layerPath of mergePaths) {
    mergeTokenGroups(merged, readSharedLayer(layerPath));
  }
  return merged;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function composeDenaliSemanticSlices(manifest) {
  /** @type {Record<string, string>} */
  const outputs = {};

  for (const output of manifest.outputs) {
    const sliceFile = output.sliceFile;
    if (typeof sliceFile !== "string") {
      throw new Error("compose manifest output missing sliceFile");
    }

  /** @type {Record<string, unknown>} */
    let slice;

    if (output.format === "blocks") {
      const blocks = output.blocks;
      if (!Array.isArray(blocks)) {
        throw new Error(`${sliceFile}: blocks format requires blocks[]`);
      }
      slice = {
        $schema: manifest.$schema ?? "https://design-tokens.github.io/community-group/format/",
        workspaceId: manifest.workspaceId ?? "denali",
        blocks: blocks.map((block) => ({
          scopeSelector: block.scopeSelector,
          ...mergeSharedLayers(block.merge),
        })),
      };
    } else if (output.format === "scoped") {
      const scopeSelector = output.scopeSelector;
      if (typeof scopeSelector !== "string") {
        throw new Error(`${sliceFile}: scoped format requires scopeSelector`);
      }
      const mergePaths = output.merge;
      if (!Array.isArray(mergePaths)) {
        throw new Error(`${sliceFile}: scoped format requires merge[]`);
      }
      slice = {
        $schema: manifest.$schema ?? "https://design-tokens.github.io/community-group/format/",
        workspaceId: manifest.workspaceId ?? "denali",
        scopeSelector,
        ...mergeSharedLayers(mergePaths),
      };
    } else {
      throw new Error(`${sliceFile}: unknown format ${String(output.format)}`);
    }

    outputs[sliceFile] = `${JSON.stringify(slice, null, 2)}\n`;
  }

  return outputs;
}

/**
 * @param {{ check?: boolean }} [options]
 */
export function generateDenaliSemanticSlices(options = {}) {
  if (!fs.existsSync(COMPOSE_MANIFEST)) {
    throw new Error(`missing compose manifest: ${COMPOSE_MANIFEST}`);
  }

  const manifest = JSON.parse(fs.readFileSync(COMPOSE_MANIFEST, "utf8"));
  const composed = composeDenaliSemanticSlices(manifest);

  for (const [sliceFile, nextBody] of Object.entries(composed)) {
    const outPath = path.join(DTCG_OUT_DIR, sliceFile);
    const next = nextBody;

    if (options.check) {
      if (!fs.existsSync(outPath)) {
        console.error(`denali-semantic-slices --check: missing ${outPath}`);
        process.exit(1);
      }
      const current = fs.readFileSync(outPath, "utf8");
      if (current !== next) {
        console.error(
          `denali-semantic-slices --check: ${path.relative(REPO_ROOT, outPath)} out of sync with theme/shared`,
        );
        process.exit(1);
      }
      continue;
    }

    fs.mkdirSync(DTCG_OUT_DIR, { recursive: true });
    fs.writeFileSync(outPath, next);
    console.log(
      `denali-semantic-slices: wrote packages/design-tokens/dtcg/workspaces/${sliceFile}`,
    );
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  generateDenaliSemanticSlices({ check: process.argv.includes("--check") });
}
