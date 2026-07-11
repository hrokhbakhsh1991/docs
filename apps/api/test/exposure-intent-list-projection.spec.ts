/**
 * Exposure intent list projection — AP15 P3.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_EXPOSURE = path.join(
  REPO_ROOT,
  "src/exposure/prisma-exposure-intent.repository.ts"
);

describe("exposure-intent-list-projection.spec.ts", () => {
  it("EXP-INT-01 listForConnectionScope uses select and take cap", () => {
    const source = fs.readFileSync(PRISMA_EXPOSURE, "utf8");
    assert.match(source, /async listForConnectionScope[\s\S]*select:\s*EXPOSURE_INTENT_LIST_SELECT/);
    assert.match(
      source,
      /async listForConnectionScope[\s\S]*take:\s*MAX_EXPOSURE_INTENTS_PER_CONNECTION/
    );
  });

  it("EXP-INT-02 listForConnectionScopes uses batch take and per-connection cap", () => {
    const source = fs.readFileSync(PRISMA_EXPOSURE, "utf8");
    assert.match(
      source,
      /async listForConnectionScopes[\s\S]*take:\s*MAX_EXPOSURE_INTENTS_CONNECTION_BATCH/
    );
    assert.match(source, /MAX_EXPOSURE_INTENTS_PER_CONNECTION/);
  });
});
