/**
 * Generates platform theme CSS from DTCG JSON (Phase E — build authority).
 * E1 scope: themes/light.css color + focus tokens only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dtcgPath = path.join(packageRoot, "dtcg/platform.tokens.json");
const lightCssPath = path.join(packageRoot, "src/themes/light.css");

/** Groups emitted into themes/light.css (E1). Primitives stay in primitives.css until E2. */
const LIGHT_THEME_GROUPS = new Set(["color", "focus"]);

const GENERATED_HEADER = `/** @generated — do not edit; source: dtcg/platform.tokens.json — run pnpm build in @app-tour/design-tokens */
/**
 * Light theme — platform semantic colors (DTCG authority).
 */`;

/**
 * @param {string[]} parts e.g. ["color", "primary"] → --color-primary
 */
export function dtcgPathToCssVar(parts) {
  return `--${parts.join("-")}`;
}

/**
 * @param {Record<string, unknown>} node
 * @param {string[]} prefix
 * @returns {{ parts: string[]; value: string }[]}
 */
export function flattenDtcgTokens(node, prefix = []) {
  /** @type {{ parts: string[]; value: string }[]} */
  const entries = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema") {
      continue;
    }
    const nextPrefix = [...prefix, key];
    if (
      value !== null &&
      typeof value === "object" &&
      "$type" in value &&
      "$value" in value &&
      typeof value.$value === "string"
    ) {
      entries.push({ parts: nextPrefix, value: value.$value.trim() });
      continue;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      entries.push(...flattenDtcgTokens(value, nextPrefix));
    }
  }
  return entries;
}

/**
 * @param {Record<string, unknown>} dtcg
 */
export function generateLightThemeCss(dtcg) {
  /** @type {{ parts: string[]; value: string }[]} */
  const themeEntries = [];
  for (const group of LIGHT_THEME_GROUPS) {
    const slice = dtcg[group];
    if (slice && typeof slice === "object") {
      themeEntries.push(...flattenDtcgTokens(slice, [group]));
    }
  }

  themeEntries.sort((left, right) => dtcgPathToCssVar(left.parts).localeCompare(dtcgPathToCssVar(right.parts)));

  const body = themeEntries
    .map(({ parts, value }) => `  ${dtcgPathToCssVar(parts)}: ${value};`)
    .join("\n");

  return `${GENERATED_HEADER}
:root,
.theme-light {
${body}

  color-scheme: light;
}
`;
}

/**
 * @param {{ check?: boolean }} [options]
 */
export function generateDtcgLightTheme(options = {}) {
  if (!fs.existsSync(dtcgPath)) {
    console.error("generate-dtcg-theme: missing dtcg/platform.tokens.json");
    process.exit(1);
  }
  const dtcg = JSON.parse(fs.readFileSync(dtcgPath, "utf8"));
  const nextCss = `${generateLightThemeCss(dtcg)}\n`;

  if (options.check) {
    if (!fs.existsSync(lightCssPath)) {
      console.error("generate-dtcg-theme --check: themes/light.css missing (run build)");
      process.exit(1);
    }
    const current = fs.readFileSync(lightCssPath, "utf8");
    if (current !== nextCss) {
      console.error("generate-dtcg-theme --check: themes/light.css is out of sync with DTCG");
      process.exit(1);
    }
    return nextCss;
  }

  fs.mkdirSync(path.dirname(lightCssPath), { recursive: true });
  fs.writeFileSync(lightCssPath, nextCss);
  console.log(`generate-dtcg-theme: wrote themes/light.css (${nextCss.split("\n").length} lines)`);
  return nextCss;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const check = process.argv.includes("--check");
  generateDtcgLightTheme({ check });
}
