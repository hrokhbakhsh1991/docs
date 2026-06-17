import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REACT_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/react.ts"
);

describe("react.ts — schemaGate live config (WEB-P11-HERMETIC-01b)", () => {
  it("createEngineWithLiveConfig forwards schemaGate getter to DraftEngine", () => {
    const source = readFileSync(REACT_SOURCE, "utf8");
    assert.match(source, /get schemaGate\(\)/);
    assert.match(source, /configRef\.current\.schemaGate/);
  });
});
