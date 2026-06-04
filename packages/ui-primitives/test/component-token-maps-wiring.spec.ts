import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  alertVariantColorTokens,
  alertVariants,
  badgeVariantColorTokens,
  badgeVariants,
  buttonVariantColorTokens,
  buttonVariants,
  componentCssTokenMaps,
} from "../src/tokens/component-token-maps";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

const COMPONENT_CSS: Record<keyof typeof componentCssTokenMaps, string> = {
  button: "Button/Button.module.css",
  input: "Input/Input.module.css",
  select: "Select/Select.module.css",
  checkbox: "Checkbox/Checkbox.module.css",
  fieldShell: "FieldShell/FieldShell.module.css",
  alert: "Alert/Alert.module.css",
  badge: "Badge/Badge.module.css",
};

/** Property values must use var(--*) — no raw px, unitless weights, or keyword colors. */
const FORBIDDEN_LITERAL_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /font-weight:\s*\d+/i, label: "font-weight numeric literal" },
  { pattern: /line-height:\s*\d+(\.\d+)?\s*;/i, label: "line-height numeric literal" },
  { pattern: /width:\s*100%/i, label: "width: 100%" },
  { pattern: /min-width:\s*0\s*;/i, label: "min-width: 0" },
  { pattern: /flex:\s*\d+/i, label: "flex numeric literal" },
  { pattern: /flex-shrink:\s*\d+/i, label: "flex-shrink numeric literal" },
  { pattern: /\bmargin:\s*0\s*;/i, label: "margin: 0" },
  { pattern: /margin:\s*var\([^)]+\)\s+0\s+/i, label: "margin with raw 0" },
  { pattern: /:\s*transparent\s*;/i, label: "transparent keyword" },
  { pattern: /:\s*inherit\s*;/i, label: "inherit keyword" },
  { pattern: /:\s*nowrap\s*;/i, label: "nowrap keyword" },
  { pattern: /:\s*pointer\s*;/i, label: "pointer keyword" },
  { pattern: /:\s*not-allowed\s*;/i, label: "not-allowed keyword" },
  { pattern: /:\s*flex\s*;/i, label: "flex keyword" },
  { pattern: /:\s*inline-flex\s*;/i, label: "inline-flex keyword" },
  { pattern: /:\s*block\s*;/i, label: "block keyword" },
  { pattern: /:\s*column\s*;/i, label: "column keyword" },
  { pattern: /:\s*center\s*;/i, label: "center keyword" },
  { pattern: /:\s*flex-start\s*;/i, label: "flex-start keyword" },
  { pattern: /:\s*currentColor\s*;/i, label: "currentColor keyword" },
  { pattern: /:\s*[^;]*\ssolid\s*;/i, label: "solid keyword" },
  { pattern: /:global\(/i, label: ":global() coupling" },
  { pattern: /:\s*\d+px\b/i, label: "px literal in property value" },
  { pattern: /:\s*\d+(\.\d+)?rem\b/i, label: "rem literal in property value (use --space-*)" },
];

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractCssVariables(css: string): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    names.add(match[1]!);
  }
  return names;
}

function collectAllowedTokens(component: keyof typeof componentCssTokenMaps): Set<string> {
  const allowed = new Set<string>(Object.values(componentCssTokenMaps[component]));
  if (component === "button") {
    for (const variant of buttonVariants) {
      for (const token of buttonVariantColorTokens[variant]) {
        allowed.add(token);
      }
    }
  }
  if (component === "alert") {
    for (const variant of alertVariants) {
      for (const token of alertVariantColorTokens[variant]) {
        allowed.add(token);
      }
    }
  }
  if (component === "badge") {
    for (const variant of badgeVariants) {
      for (const token of badgeVariantColorTokens[variant]) {
        allowed.add(token);
      }
    }
  }
  return allowed;
}

function findForbiddenLiterals(css: string): string[] {
  const withoutComments = stripCssComments(css);
  const lines = withoutComments
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("}"));

  const violations: string[] = [];
  for (const line of lines) {
    for (const { pattern, label } of FORBIDDEN_LITERAL_PATTERNS) {
      if (pattern.test(line) && !violations.includes(label)) {
        violations.push(label);
      }
    }
  }
  return violations;
}

describe("component token maps wired to CSS modules", () => {
  for (const [component, relativeCssPath] of Object.entries(COMPONENT_CSS)) {
    const key = component as keyof typeof componentCssTokenMaps;
    const cssPath = path.join(srcRoot, relativeCssPath);

    it(`${component} module only uses tokens listed in componentCssTokenMaps`, () => {
      const css = fs.readFileSync(cssPath, "utf8");
      const used = extractCssVariables(css);
      const allowed = collectAllowedTokens(key);

      const missingFromMap: string[] = [];
      for (const token of used) {
        if (!allowed.has(token)) {
          missingFromMap.push(token);
        }
      }

      assert.deepEqual(
        missingFromMap,
        [],
        `${relativeCssPath} uses tokens not declared in ${key} map: ${missingFromMap.join(", ")}`,
      );
    });

    it(`${component} module has no raw numeric or keyword literals in property values`, () => {
      const css = fs.readFileSync(cssPath, "utf8");
      const violations = findForbiddenLiterals(css);
      assert.deepEqual(
        violations,
        [],
        `${relativeCssPath} contains forbidden literals: ${violations.join(", ")}`,
      );
    });
  }
});
