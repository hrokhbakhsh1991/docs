/**
 * Generates platform semantics.css from DTCG (Phase F5).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dtcgPathToCssVar, flattenDtcgTokens } from "./generate-dtcg-theme.mjs";
import { resolveDtcgReferenceValue } from "./generate-workspace-dtcg-css.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const semanticsDtcgPath = path.join(packageRoot, "dtcg/platform.semantics.tokens.json");
const semanticsCssPath = path.join(packageRoot, "src/semantics.css");

const SEMANTIC_GROUPS = new Set(["color"]);

/**
 * @param {Record<string, unknown>} dtcg
 */
export function generateSemanticsCss(dtcg) {
  /** @type {{ parts: string[]; value: string }[]} */
  const entries = [];
  for (const group of SEMANTIC_GROUPS) {
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

  return `/** @generated — do not edit; source: dtcg/platform.semantics.tokens.json — run pnpm build in @app-tour/design-tokens */
/**
 * Semantic aliases — components read these, not raw theme keys.
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
export function generateDtcgSemantics(options = {}) {
  if (!fs.existsSync(semanticsDtcgPath)) {
    console.error("generate-dtcg-semantics: missing dtcg/platform.semantics.tokens.json");
    process.exit(1);
  }

  const dtcg = JSON.parse(fs.readFileSync(semanticsDtcgPath, "utf8"));
  const nextCss = `${generateSemanticsCss(dtcg)}\n`;

  if (options.check) {
    if (!fs.existsSync(semanticsCssPath)) {
      console.error("generate-dtcg-semantics --check: src/semantics.css missing (run build)");
      process.exit(1);
    }
    const current = fs.readFileSync(semanticsCssPath, "utf8");
    if (current !== nextCss) {
      console.error("generate-dtcg-semantics --check: src/semantics.css is out of sync with DTCG");
      process.exit(1);
    }
    return nextCss;
  }

  fs.writeFileSync(semanticsCssPath, nextCss);
  console.log("generate-dtcg-semantics: wrote src/semantics.css");
  return nextCss;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  generateDtcgSemantics({ check: process.argv.includes("--check") });
}
