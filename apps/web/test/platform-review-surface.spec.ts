import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveGeneratedReviewSurface } from "../src/bootstrap/wizard-surface-bindings.generated";
import { createPlatformReviewSurface } from "../src/wizard/platform/platform-review-surface";

describe("platform review surface (P3-B-N-012)", () => {
  it("RV-01 resolveGeneratedReviewSurface(platform) non-null after codegen", () => {
    assert.notEqual(resolveGeneratedReviewSurface("platform"), null);
  });

  it("RV-02 createPlatformReviewSurface exports renderValidationSummary", () => {
    const surface = createPlatformReviewSurface();
    assert.equal(typeof surface.renderValidationSummary, "function");
  });
});

describe("platform theme host props (P3-B-N-014)", () => {
  it("TH-web applies data-workspace-theme marker with tokens", async () => {
    const { platformThemeHostProps } = await import("../src/wizard/platform/platform-theme-tokens");
    const props = platformThemeHostProps({ "--ws-primary": "var(--color-primary)" });
    assert.equal(props["data-workspace-theme"], "platform");
    assert.equal(props.style?.["--ws-primary"], "var(--color-primary)");
  });
});

describe("generated bindings EPIC exit markers", () => {
  it("EX-03 bindings contain denali dynamic loader + platform eager cache", () => {
    const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    const source = readFileSync(
      join(webRoot, "src/bootstrap/wizard-surface-bindings.generated.ts"),
      "utf8"
    );
    assert.match(source, /"denali":\s*async\s*\(\)\s*=>/);
    assert.match(source, /await import\("@app-tour\/workspace-denali\/host\/ui\/composite-surface"\)/);
    assert.match(source, /\["platform", createPlatformCompositeSurface\(\)\]/);
    assert.match(source, /\["platform", createPlatformReviewSurface\(\)\]/);
  });
});
