/**
 * Generates platform primitives.css from DTCG (Phase F4).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dtcgPathToCssVar, flattenDtcgTokens } from "./generate-dtcg-theme.mjs";
import { resolveDtcgReferenceValue } from "./generate-workspace-dtcg-css.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const primitivesDtcgPath = path.join(packageRoot, "dtcg/platform.primitives.tokens.json");
const primitivesCssPath = path.join(packageRoot, "src/primitives.css");

const PRIMITIVE_GROUPS = new Set([
  "font",
  "text",
  "font-weight",
  "space",
  "radius",
  "layout",
  "color",
  "line-height",
  "border-width",
  "focus",
  "opacity",
  "shadow",
  "z",
]);

/**
 * @param {Record<string, unknown>} dtcg
 */
export function generatePrimitivesCss(dtcg) {
  /** @type {{ parts: string[]; value: string }[]} */
  const entries = [];
  for (const group of PRIMITIVE_GROUPS) {
    const slice = dtcg[group];
    if (slice && typeof slice === "object") {
      entries.push(
        ...flattenDtcgTokens(slice, [group]).map((entry) => ({
          parts: entry.parts,
          value: resolveDtcgReferenceValue(entry.value),
        })),
      );
    }
  }

  entries.sort((left, right) => dtcgPathToCssVar(left.parts).localeCompare(dtcgPathToCssVar(right.parts)));

  const body = entries.map((entry) => `  ${dtcgPathToCssVar(entry.parts)}: ${entry.value};`).join("\n");

  return `/** @generated — do not edit; source: dtcg/platform.primitives.tokens.json — run pnpm build in @app-tour/design-tokens */
/**
 * Platform primitives — spacing, typography scale, layout, elevation.
 * Theme-agnostic; color primitives live in theme files.
 */
:root,
.theme-light,
.theme-dark {
${body}
}
`;
}

/**
 * @param {{ check?: boolean }} [options]
 */
export function generateDtcgPrimitives(options = {}) {
  if (!fs.existsSync(primitivesDtcgPath)) {
    console.error("generate-dtcg-primitives: missing dtcg/platform.primitives.tokens.json");
    process.exit(1);
  }

  const dtcg = JSON.parse(fs.readFileSync(primitivesDtcgPath, "utf8"));
  const nextCss = `${generatePrimitivesCss(dtcg)}\n`;

  if (options.check) {
    if (!fs.existsSync(primitivesCssPath)) {
      console.error("generate-dtcg-primitives --check: src/primitives.css missing (run build)");
      process.exit(1);
    }
    const current = fs.readFileSync(primitivesCssPath, "utf8");
    if (current !== nextCss) {
      console.error("generate-dtcg-primitives --check: src/primitives.css is out of sync with DTCG");
      process.exit(1);
    }
    return nextCss;
  }

  fs.writeFileSync(primitivesCssPath, nextCss);
  console.log("generate-dtcg-primitives: wrote src/primitives.css");
  return nextCss;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  generateDtcgPrimitives({ check: process.argv.includes("--check") });
}
