import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SDK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("tour-clone-hydrator.contract.spec.ts (P13-7)", () => {
  it("P13-7-01 dist exports WizardPhotoRemintPlanEntry type surface", () => {
    const probe = `
      const sdk = await import(${JSON.stringify(path.join(SDK_ROOT, "dist/index.js"))});
      if (typeof sdk.WizardPhotoRemintPlanEntry !== "undefined") {
        console.error("WizardPhotoRemintPlanEntry must be type-only");
        process.exit(1);
      }
      if (typeof sdk.DenaliPhotoRemintPlanEntry !== "undefined") {
        console.error("DenaliPhotoRemintPlanEntry must be type-only");
        process.exit(1);
      }
      console.log("P13_7_TYPE_SURFACE_OK");
    `;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
      cwd: SDK_ROOT,
      encoding: "utf8",
    });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    assert.equal(r.status, 0, out);
    if (out.length > 0) {
      assert.match(out, /P13_7_TYPE_SURFACE_OK/);
    }
  });

  it("P13-7-02 contract source uses neutral photoRemintPlan entry type", () => {
    const source = fs.readFileSync(
      path.join(SDK_ROOT, "src/tour/tour-clone-hydrator.contract.ts"),
      "utf8"
    );
    assert.match(source, /export type WizardPhotoRemintPlanEntry/);
    assert.match(source, /photoRemintPlan\?: readonly WizardPhotoRemintPlanEntry\[\]/);
    assert.match(source, /export type DenaliPhotoRemintPlanEntry = WizardPhotoRemintPlanEntry/);
  });
});
