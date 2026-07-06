import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Resolves a split marketing skin entry (@import partials) into one CSS string.
 */
export function readMarketingSkinBundle(entryPath: string): string {
  /** @type {Set<string>} */
  const seen = new Set();

  function readWithImports(absPath: string): string {
    if (seen.has(absPath) || !existsSync(absPath)) {
      return "";
    }
    seen.add(absPath);
    const css = readFileSync(absPath, "utf8");
    let bundle = css;
    for (const match of css.matchAll(/@import\s+"\.\/([^"]+)"/g)) {
      bundle += `\n${readWithImports(join(dirname(absPath), match[1]))}`;
    }
    return bundle;
  }

  return readWithImports(entryPath);
}
