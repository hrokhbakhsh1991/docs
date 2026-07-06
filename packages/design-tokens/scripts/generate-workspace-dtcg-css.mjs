/**
 * Generates workspace theme/tokens.css from DTCG workspace slices (Phase E2).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dtcgPathToCssVar, flattenDtcgTokens } from "./generate-dtcg-theme.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");
const workspacesDtcgDir = path.join(packageRoot, "dtcg/workspaces");

const WORKSPACE_METADATA_KEYS = new Set(["$schema", "workspaceId", "scopeSelector"]);

/**
 * @param {string} raw
 */
export function resolveDtcgReferenceValue(raw) {
  const trimmed = raw.trim();
  const refMatch = trimmed.match(/^\{([a-z0-9.-]+)\}$/i);
  if (refMatch) {
    return `var(--${refMatch[1].replace(/\./g, "-")})`;
  }
  return trimmed;
}

/**
 * @param {Record<string, unknown>} slice
 */
export function flattenWorkspaceDtcgTokens(slice, prefix) {
  return flattenDtcgTokens(slice, prefix).map((entry) => ({
    cssVar: dtcgPathToCssVar(entry.parts),
    value: resolveDtcgReferenceValue(entry.value),
  }));
}

/**
 * @param {Record<string, unknown>} dtcg
 * @param {string} sourceLabel
 */
export function generateWorkspaceTokensCss(dtcg, sourceLabel) {
  const scopeSelector =
    typeof dtcg.scopeSelector === "string" && dtcg.scopeSelector.trim().length > 0
      ? dtcg.scopeSelector.trim()
      : "[data-workspace-theme]";

  /** @type {{ cssVar: string; value: string }[]} */
  const entries = [];
  for (const [key, value] of Object.entries(dtcg)) {
    if (WORKSPACE_METADATA_KEYS.has(key)) {
      continue;
    }
    if (value && typeof value === "object") {
      entries.push(...flattenWorkspaceDtcgTokens(value, [key]));
    }
  }

  entries.sort((left, right) => left.cssVar.localeCompare(right.cssVar));

  const body = entries.map((entry) => `  ${entry.cssVar}: ${entry.value};`).join("\n");

  return `/** @generated — do not edit; source: ${sourceLabel} — run pnpm build in @app-tour/design-tokens */
/**
 * Workspace brand tokens — ${typeof dtcg.workspaceId === "string" ? dtcg.workspaceId : "workspace"} plugin.
 * Host loads via WorkspaceThemeContract.optionalStylesheet after CASL + ingress.
 */
${scopeSelector} {
${body}
}
`;
}

/**
 * @param {{ check?: boolean }} [options]
 */
export function generateWorkspaceDtcgCss(options = {}) {
  if (!fs.existsSync(workspacesDtcgDir)) {
    if (options.check) {
      return;
    }
    console.log("generate-workspace-dtcg-css: no dtcg/workspaces slices — skip");
    return;
  }

  const slices = fs
    .readdirSync(workspacesDtcgDir)
    .filter((name) => name.endsWith(".tokens.json"))
    .sort();

  for (const fileName of slices) {
    const slicePath = path.join(workspacesDtcgDir, fileName);
    const dtcg = JSON.parse(fs.readFileSync(slicePath, "utf8"));
    const workspaceId =
      typeof dtcg.workspaceId === "string" && dtcg.workspaceId.trim().length > 0
        ? dtcg.workspaceId.trim()
        : fileName.replace(/\.tokens\.json$/, "");
    const outputPath = path.join(repoRoot, "packages/workspaces", workspaceId, "theme/tokens.css");
    const sourceLabel = `dtcg/workspaces/${fileName}`;
    const nextCss = `${generateWorkspaceTokensCss(dtcg, sourceLabel)}\n`;

    if (options.check) {
      if (!fs.existsSync(outputPath)) {
        console.error(`generate-workspace-dtcg-css --check: missing ${outputPath}`);
        process.exit(1);
      }
      const current = fs.readFileSync(outputPath, "utf8");
      if (current !== nextCss) {
        console.error(
          `generate-workspace-dtcg-css --check: ${path.relative(repoRoot, outputPath)} out of sync with DTCG`,
        );
        process.exit(1);
      }
      continue;
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, nextCss);
    console.log(
      `generate-workspace-dtcg-css: wrote packages/workspaces/${workspaceId}/theme/tokens.css`,
    );
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  generateWorkspaceDtcgCss({ check: process.argv.includes("--check") });
}
