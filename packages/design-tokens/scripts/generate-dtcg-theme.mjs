/**
 * Generates platform theme CSS from DTCG JSON (Phase E — build authority).
 * E1: themes/light.css · E2: themes/dark.css
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lightDtcgPath = path.join(packageRoot, "dtcg/platform.tokens.json");
const darkDtcgPath = path.join(packageRoot, "dtcg/platform.dark.tokens.json");
const lightCssPath = path.join(packageRoot, "src/themes/light.css");
const darkCssPath = path.join(packageRoot, "src/themes/dark.css");

const LIGHT_THEME_GROUPS = new Set(["color", "focus"]);
const DARK_THEME_GROUPS = new Set(["color", "focus", "shadow"]);

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
 * @param {Set<string>} groups
 * @param {{ selectors: string; colorScheme: string; source: string; title: string }} config
 */
export function generatePlatformThemeCss(dtcg, groups, config) {
  /** @type {{ parts: string[]; value: string }[]} */
  const themeEntries = [];
  for (const group of groups) {
    const slice = dtcg[group];
    if (slice && typeof slice === "object") {
      themeEntries.push(...flattenDtcgTokens(slice, [group]));
    }
  }

  themeEntries.sort((left, right) => dtcgPathToCssVar(left.parts).localeCompare(dtcgPathToCssVar(right.parts)));

  const body = themeEntries
    .map(({ parts, value }) => `  ${dtcgPathToCssVar(parts)}: ${value};`)
    .join("\n");

  return `/** @generated — do not edit; source: ${config.source} — run pnpm build in @app-tour/design-tokens */
/**
 * ${config.title}
 */
${config.selectors} {
${body}

  color-scheme: ${config.colorScheme};
}
`;
}

/**
 * @param {Record<string, unknown>} dtcg
 */
export function generateLightThemeCss(dtcg) {
  return generatePlatformThemeCss(dtcg, LIGHT_THEME_GROUPS, {
    selectors: ":root,\n.theme-light",
    colorScheme: "light",
    source: "dtcg/platform.tokens.json",
    title: "Light theme — platform semantic colors (DTCG authority).",
  });
}

/**
 * @param {Record<string, unknown>} dtcg
 */
export function generateDarkThemeCss(dtcg) {
  return generatePlatformThemeCss(dtcg, DARK_THEME_GROUPS, {
    selectors: ".theme-dark",
    colorScheme: "dark",
    source: "dtcg/platform.dark.tokens.json",
    title: "Dark theme — platform semantic colors (DTCG authority).",
  });
}

function assertThemeFile({ check, cssPath, nextCss, label }) {
  if (check) {
    if (!fs.existsSync(cssPath)) {
      console.error(`generate-dtcg-theme --check: ${label} missing (run build)`);
      process.exit(1);
    }
    const current = fs.readFileSync(cssPath, "utf8");
    if (current !== nextCss) {
      console.error(`generate-dtcg-theme --check: ${label} is out of sync with DTCG`);
      process.exit(1);
    }
    return;
  }
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  fs.writeFileSync(cssPath, nextCss);
  console.log(`generate-dtcg-theme: wrote ${path.relative(packageRoot, cssPath)}`);
}

/**
 * @param {{ check?: boolean }} [options]
 */
export function generateDtcgPlatformThemes(options = {}) {
  if (!fs.existsSync(lightDtcgPath)) {
    console.error("generate-dtcg-theme: missing dtcg/platform.tokens.json");
    process.exit(1);
  }
  if (!fs.existsSync(darkDtcgPath)) {
    console.error("generate-dtcg-theme: missing dtcg/platform.dark.tokens.json");
    process.exit(1);
  }

  const lightDtcg = JSON.parse(fs.readFileSync(lightDtcgPath, "utf8"));
  const darkDtcg = JSON.parse(fs.readFileSync(darkDtcgPath, "utf8"));
  const lightCss = `${generateLightThemeCss(lightDtcg)}\n`;
  const darkCss = `${generateDarkThemeCss(darkDtcg)}\n`;

  assertThemeFile({ check: options.check, cssPath: lightCssPath, nextCss: lightCss, label: "themes/light.css" });
  assertThemeFile({ check: options.check, cssPath: darkCssPath, nextCss: darkCss, label: "themes/dark.css" });

  return { lightCss, darkCss };
}

/** @param {{ check?: boolean }} [options] */
export function generateDtcgLightTheme(options = {}) {
  return generateDtcgPlatformThemes(options);
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const check = process.argv.includes("--check");
  generateDtcgLightTheme({ check });
}
