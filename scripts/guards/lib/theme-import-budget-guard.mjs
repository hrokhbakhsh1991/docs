/**
 * Phase I1 — theme import budget guard logic (pure / testable).
 * @see docs/dev/workspace-scale-hardening.mdoc
 */

/**
 * @param {string} source
 * @param {string} functionName
 * @returns {string | null}
 */
export function extractAsyncFunctionBody(source, functionName) {
  const marker = `export async function ${functionName}`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) return null;

  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, i);
      }
    }
  }
  return null;
}

/**
 * @param {string} body
 * @returns {number}
 */
export function countAwaitDynamicImports(body) {
  return (body.match(/await import\s*\(/g) ?? []).length;
}

/**
 * Max imports allowed on any single switch path through the function body.
 * @param {string} body
 * @returns {number}
 */
export function maxImportsPerSwitchPath(body) {
  const lines = body.split("\n");
  let maxOnPath = 0;
  let currentPath = 0;
  let inSwitch = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("switch ")) {
      inSwitch = true;
      currentPath = 0;
      continue;
    }
    if (!inSwitch) {
      if (/await import\s*\(/.test(line)) {
        currentPath += 1;
        maxOnPath = Math.max(maxOnPath, currentPath);
      }
      continue;
    }
    if (trimmed.startsWith("case ") || trimmed === "default:") {
      currentPath = 0;
      for (const prior of lines) {
        if (prior === line) break;
      }
      // Count imports before switch on first case entry only — handled below via pre-switch scan
    }
    if (/await import\s*\(/.test(line)) {
      currentPath += 1;
      maxOnPath = Math.max(maxOnPath, currentPath);
    }
    if (trimmed.startsWith("return") || trimmed.startsWith("break")) {
      currentPath = 0;
    }
  }

  const beforeSwitch = body.split("switch")[0] ?? "";
  const preSwitchImports = countAwaitDynamicImports(beforeSwitch);
  return Math.max(maxOnPath + preSwitchImports, preSwitchImports);
}

/**
 * @param {{
 *   generated: string;
 *   layout: string;
 *   loaderName: string;
 *   layoutCallPattern: RegExp;
 *   maxImportsPerPath: number;
 *   surface: string;
 * }} input
 * @returns {string[]}
 */
export function collectThemeLoaderViolations(input) {
  const { generated, layout, loaderName, layoutCallPattern, maxImportsPerPath, surface } = input;
  /** @type {string[]} */
  const violations = [];

  if (/^import ["']@app-tour\/workspace-/m.test(generated)) {
    violations.push(`${surface}: generated bootstrap must not eager-import workspace skins`);
  }
  if (!generated.includes(loaderName)) {
    violations.push(`${surface}: generated bootstrap must export ${loaderName}`);
  }
  if (!layoutCallPattern.test(layout)) {
    violations.push(`${surface}: layout must await ${loaderName} for active pluginId only`);
  }
  if (/import ["']@\/bootstrap\/workspace-[^"']+theme-stylesheets\.generated["'];\s*$/m.test(layout)) {
    violations.push(`${surface}: layout must not side-effect import theme bootstrap`);
  }

  const calls = layout.match(new RegExp(`await ${loaderName}\\(`, "g"));
  if ((calls?.length ?? 0) !== 1) {
    violations.push(`${surface}: layout must call ${loaderName} exactly once (got ${calls?.length ?? 0})`);
  }

  const body = extractAsyncFunctionBody(generated, loaderName);
  if (!body) {
    violations.push(`${surface}: missing ${loaderName} body`);
    return violations;
  }

  const perPath = maxImportsPerSwitchPath(body);
  if (perPath > maxImportsPerPath) {
    violations.push(
      `${surface}: ${loaderName} exceeds import budget (${perPath} > ${maxImportsPerPath} per path)`
    );
  }

  return violations;
}
