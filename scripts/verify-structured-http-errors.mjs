#!/usr/bin/env node
/**
 * Infrastructure sign-off — API HTTP errors must log structured `error_code` and return envelope JSON.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILTER_PATH = path.resolve(
  __dirname,
  "../apps/api/src/common/errors/global-exception.filter.ts",
);

function main() {
  const text = fs.readFileSync(FILTER_PATH, "utf8");
  const violations = [];

  const errorLogCalls = [...text.matchAll(/this\.loggerService\.error\s*\(\s*["'`]([^"'`]+)["'`]/g)];
  for (const match of errorLogCalls) {
    const label = match[1];
    const idx = match.index ?? 0;
    const slice = text.slice(idx, idx + 600);
    if (!slice.includes("error_code:")) {
      const line = text.slice(0, idx).split("\n").length;
      violations.push(
        `[STRUCTURED_ERROR_LOG] global-exception.filter.ts:${line} — logger "${label}" missing error_code`,
      );
    }
  }

  if (!text.includes("buildEnvelope(")) {
    violations.push("[STRUCTURED_ERROR_BODY] buildEnvelope() not used in GlobalExceptionFilter");
  }

  if (!text.includes("success: false")) {
    violations.push("[STRUCTURED_ERROR_BODY] success:false envelope shape not found");
  }

  const unknownFallback = text.match(/code:\s*["']UNKNOWN_ERROR["']/g);
  if (unknownFallback && unknownFallback.length > 2) {
    violations.push(
      "[STRUCTURED_ERROR_CODE] excessive UNKNOWN_ERROR fallbacks — map to GlobalErrorTaxonomy",
    );
  }

  if (violations.length > 0) {
    for (const _v of violations) {
    }
    process.exit(1);
  }

}

main();
