/**
 * WALLET-P2D — wallet-http-contracts import boundary.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("wallet-http-contracts boundary", () => {
  it("has no API, Prisma, or workspace imports", () => {
    const files = readdirSync(SRC).filter((name) => name.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(SRC, file), "utf8");
      assert.doesNotMatch(src, /@prisma\/client|apps\/api/);
      assert.doesNotMatch(src, /packages\/workspaces\//);
      assert.doesNotMatch(src, /@app-tour\/workspace-/);
    }
  });
});
