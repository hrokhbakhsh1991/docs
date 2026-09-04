/**
 * MEG-001 — engagement-http package boundary proof.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("engagement-http boundary", () => {
  it("has no Prisma, Denali, or workspace implementation imports", () => {
    const files = readdirSync(SRC).filter((name) => name.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(SRC, file), "utf8");
      assert.doesNotMatch(src, /@prisma\/client|from ["']@prisma/);
      assert.doesNotMatch(src, /workspace-denali|@app-tour\/workspace-denali/);
      assert.doesNotMatch(src, /packages\/workspaces\//);
      assert.doesNotMatch(src, /next\/server|from ["']next\//);
    }
  });

  it("depends on engagement contracts and host ports only", () => {
    const routes = readFileSync(join(SRC, "engagement.routes.ts"), "utf8");
    assert.doesNotMatch(routes, /PrismaEngagement|engagementProfile\.find/);
    assert.match(routes, /@app-tour\/engagement-http-contracts/);
  });

  it("exports stable route manifest paths", () => {
    const manifest = readFileSync(join(SRC, "routes-manifest.ts"), "utf8");
    assert.match(manifest, /\/engagement\/me\/summary/);
    assert.match(manifest, /\/engagement\/operator\/overview/);
  });
});
