import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const PACKAGE_ROOT = resolve(import.meta.dirname, "..");

describe("@app-tour/iran-mountain-landmarks package exports", () => {
  it("publishes the public entrypoint from dist instead of source", () => {
    const pkg = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, "package.json"), "utf8")) as {
      readonly main?: string;
      readonly types?: string;
      readonly exports?: { readonly ".": { readonly default?: string; readonly types?: string } };
    };

    assert.equal(pkg.main, "./dist/index.js");
    assert.equal(pkg.types, "./dist/index.d.ts");
    assert.equal(pkg.exports?.["."].default, "./dist/index.js");
    assert.equal(pkg.exports?.["."].types, "./dist/index.d.ts");
  });
});
