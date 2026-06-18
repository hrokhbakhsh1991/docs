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

  it("createEngineWithLiveConfig forwards normalizeRemote and onPushSuccess (Track B/C)", () => {
    const source = readFileSync(REACT_SOURCE, "utf8");
    assert.match(source, /get normalizeRemote\(\)/);
    assert.match(source, /configRef\.current\.normalizeRemote/);
    assert.match(source, /get onPushSuccess\(\)/);
    assert.match(source, /configRef\.current\.onPushSuccess/);
  });

  it("createEngineWithLiveConfig forwards onDiagnostic (Phase 1 observability)", () => {
    const source = readFileSync(REACT_SOURCE, "utf8");
    assert.match(source, /get onDiagnostic\(\)/);
    assert.match(source, /configRef\.current\.onDiagnostic/);
  });

  it("createEngineWithLiveConfig forwards onAbortInFlightPush (clear draft abort)", () => {
    const source = readFileSync(REACT_SOURCE, "utf8");
    assert.match(source, /get onAbortInFlightPush\(\)/);
    assert.match(source, /configRef\.current\.onAbortInFlightPush/);
  });

  it("createEngineWithLiveConfig forwards shouldBypassServerVersionAdoption (freshStart OCC)", () => {
    const source = readFileSync(REACT_SOURCE, "utf8");
    assert.match(source, /get shouldBypassServerVersionAdoption\(\)/);
    assert.match(source, /configRef\.current\.shouldBypassServerVersionAdoption/);
  });
});
