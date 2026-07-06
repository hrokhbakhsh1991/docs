/**
 * Parses semantics.css + tokens.meta.json and emits generated TypeScript.
 * @generated output — run via packages/design-tokens build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const semanticsPath = path.join(packageRoot, "src/semantics.css");
const metaPath = path.join(packageRoot, "tokens.meta.json");
const generatedDir = path.join(packageRoot, "src/generated");

const GENERATED_BANNER = `/** @generated — do not edit; run pnpm build in @app-tour/design-tokens */\n`;

function extractSemanticVars(cssText) {
  const names = [];
  for (const line of cssText.split("\n")) {
    const match = line.match(/^\s*(--[a-z0-9-]+)\s*:/);
    if (match) {
      names.push(match[1]);
    }
  }
  return names.sort();
}

function toCamelCase(cssVar) {
  const body = cssVar.startsWith("--") ? cssVar.slice(2) : cssVar;
  return body.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function loadRegistered(meta) {
  const registered = new Set(meta.sharedVariables ?? []);
  for (const theme of Object.values(meta.themes ?? {})) {
    for (const name of theme.requiredVariables ?? []) {
      registered.add(name);
    }
  }
  return registered;
}

function unionTypeLiteral(names) {
  if (names.length === 0) {
    return "never";
  }
  return names.map((name) => JSON.stringify(name)).join(" | ");
}


const DTCG_TO_LIGHT_CSS = Object.freeze({
  "color.primary": "--color-primary",
  "color.accent": "--color-warning",
  "color.bg-page": "--color-bg-page",
  "color.text-default": "--color-text-primary",
  "color.text-muted": "--color-text-muted",
  "color.border-default": "--color-border-default",
});

function readCssVarValue(cssText, varName) {
  const re = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*([^;]+);`);
  const match = cssText.match(re);
  return match ? match[1].trim().toLowerCase() : null;
}

function validateDtcgCssSync(packageRoot) {
  const dtcgPath = path.join(packageRoot, "dtcg/platform.tokens.json");
  const lightPath = path.join(packageRoot, "src/themes/light.css");
  if (!fs.existsSync(dtcgPath) || !fs.existsSync(lightPath)) {
    console.error("generate-tokens: missing DTCG or light theme for sync validation");
    process.exit(1);
  }
  const dtcg = JSON.parse(fs.readFileSync(dtcgPath, "utf8"));
  const lightCss = fs.readFileSync(lightPath, "utf8");
  for (const [dtcgPathKey, cssVar] of Object.entries(DTCG_TO_LIGHT_CSS)) {
    const parts = dtcgPathKey.split(".");
    let node = dtcg;
    for (const part of parts) {
      node = node?.[part];
    }
    const dtcgValue = typeof node?.$value === "string" ? node.$value.trim().toLowerCase() : null;
    const cssValue = readCssVarValue(lightCss, cssVar);
    if (dtcgValue === null || cssValue === null || dtcgValue !== cssValue) {
      console.error(
        `generate-tokens: DTCG ${dtcgPathKey} (${dtcgValue}) out of sync with ${cssVar} (${cssValue})`,
      );
      process.exit(1);
    }
  }
}


function main() {
  if (!fs.existsSync(semanticsPath)) {
    console.error("generate-tokens: missing src/semantics.css");
    process.exit(1);
  }
  if (!fs.existsSync(metaPath)) {
    console.error("generate-tokens: missing tokens.meta.json");
    process.exit(1);
  }

  validateDtcgCssSync(packageRoot);
  const semanticsCss = fs.readFileSync(semanticsPath, "utf8");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const semanticNames = extractSemanticVars(semanticsCss);
  const registered = loadRegistered(meta);

  if (semanticNames.length === 0) {
    console.error("generate-tokens: no semantic variables found in semantics.css");
    process.exit(1);
  }

  for (const name of semanticNames) {
    if (!registered.has(name)) {
      console.error(
        `generate-tokens: semantic variable ${name} is not registered in tokens.meta.json`,
      );
      process.exit(1);
    }
  }

  const semanticEntries = semanticNames.map((name) => {
    const key = toCamelCase(name);
    return `  ${key}: ${JSON.stringify(name)},`;
  });

  const shared = [...(meta.sharedVariables ?? [])].sort();
  const light = [...(meta.themes?.light?.requiredVariables ?? [])].sort();
  const dark = [...(meta.themes?.dark?.requiredVariables ?? [])].sort();
  const platform = [...registered].sort();

  const semanticTokensTs = `${GENERATED_BANNER}
export const semanticTokenVars = {
${semanticEntries.join("\n")}
} as const;

export type SemanticTokenKey = keyof typeof semanticTokenVars;
export type SemanticCssVariable = (typeof semanticTokenVars)[SemanticTokenKey];

export function semanticVar(key: SemanticTokenKey): \`var(\${SemanticCssVariable})\` {
  return \`var(\${semanticTokenVars[key]})\`;
}
`;

  const tokensTypesTs = `${GENERATED_BANNER}
export type SemanticCssVariableName = ${unionTypeLiteral(semanticNames)};
export type SharedCssVariable = ${unionTypeLiteral(shared)};
export type LightThemeCssVariable = ${unionTypeLiteral(light)};
export type DarkThemeCssVariable = ${unionTypeLiteral(dark)};
export type PlatformCssVariable = ${unionTypeLiteral(platform)};
`;

  fs.mkdirSync(generatedDir, { recursive: true });

  for (const legacy of ["tokens.generated.ts", "tokens.d.ts"]) {
    const legacyPath = path.join(generatedDir, legacy);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
    }
  }

  fs.writeFileSync(path.join(generatedDir, "semantic-tokens.ts"), semanticTokensTs);
  fs.writeFileSync(path.join(generatedDir, "tokens.ts"), tokensTypesTs);

  console.log(
    `generate-tokens: wrote semantic-tokens.ts (${semanticNames.length} vars) and tokens.ts (${platform.length} platform types)`,
  );
}

main();
