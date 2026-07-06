/**
 * Generates workspace theme CSS from DTCG workspace slices (Phase E2–E4).
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
 * @param {string[]} prefix
 */
export function flattenWorkspaceDtcgTokens(slice, prefix) {
  return flattenDtcgTokens(slice, prefix).map((entry) => ({
    cssVar: dtcgPathToCssVar(entry.parts),
    value: resolveDtcgReferenceValue(entry.value),
  }));
}

/**
 * @param {string} fileName
 * @param {string} workspaceId
 */
export function resolveWorkspaceSliceOutputRelativePath(fileName, workspaceId) {
  if (fileName === `${workspaceId}.tokens.json`) {
    return "theme/tokens.css";
  }
  if (fileName === `${workspaceId}.marketing.tokens.json`) {
    return "theme/marketing/semantic-tokens.css";
  }
  if (fileName === `${workspaceId}.portal.tokens.json`) {
    return "theme/portal-semantic-tokens.css";
  }
  throw new Error(`unknown workspace DTCG slice filename: ${fileName}`);
}

/**
 * @param {string} fileName
 * @param {string} workspaceId
 */
function sliceCssDescription(fileName, workspaceId) {
  if (fileName === `${workspaceId}.tokens.json`) {
    return `Workspace brand tokens — ${workspaceId} plugin.\n * Host loads via WorkspaceThemeContract.optionalStylesheet after CASL + ingress.`;
  }
  if (fileName.endsWith(".marketing.tokens.json")) {
    return `${workspaceId} marketing semantic colors (DTCG authority).`;
  }
  if (fileName.endsWith(".portal.tokens.json")) {
    return `${workspaceId} portal semantic colors (DTCG authority).`;
  }
  return `${workspaceId} workspace tokens.`;
}

/**
 * @param {string} fileName
 * @param {Record<string, unknown>} dtcg
 */
export function resolveWorkspaceIdFromSlice(fileName, dtcg) {
  if (typeof dtcg.workspaceId === "string" && dtcg.workspaceId.trim().length > 0) {
    return dtcg.workspaceId.trim();
  }
  const match = fileName.match(/^([^.]+)\./);
  if (match?.[1]) {
    return match[1];
  }
  return fileName.replace(/\.tokens\.json$/, "");
}

/**
 * @param {Record<string, unknown>} dtcg
 * @param {string} sourceLabel
 * @param {string} fileName
 * @param {string} workspaceId
 */
export function generateWorkspaceTokensCss(dtcg, sourceLabel, fileName, workspaceId) {
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
    if (!value || typeof value !== "object") {
      continue;
    }
    const prefix = key === "flat" ? [] : [key];
    entries.push(...flattenWorkspaceDtcgTokens(value, prefix));
  }

  entries.sort((left, right) => left.cssVar.localeCompare(right.cssVar));

  const body = entries.map((entry) => `  ${entry.cssVar}: ${entry.value};`).join("\n");

  return `/** @generated — do not edit; source: ${sourceLabel} — run pnpm build in @app-tour/design-tokens */
/**
 * ${sliceCssDescription(fileName, workspaceId)}
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
    const workspaceId = resolveWorkspaceIdFromSlice(fileName, dtcg);
    const outputRelativePath = resolveWorkspaceSliceOutputRelativePath(fileName, workspaceId);
    const outputPath = path.join(repoRoot, "packages/workspaces", workspaceId, outputRelativePath);
    const sourceLabel = `dtcg/workspaces/${fileName}`;
    const nextCss = `${generateWorkspaceTokensCss(dtcg, sourceLabel, fileName, workspaceId)}\n`;

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
      `generate-workspace-dtcg-css: wrote packages/workspaces/${workspaceId}/${outputRelativePath}`,
    );
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  generateWorkspaceDtcgCss({ check: process.argv.includes("--check") });
}
