import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const assessmentPath = join(repoRoot, "docs/phase-18/agent-pack/wizard-denali-enterprise-assessment.md");
const roadmapPath = join(repoRoot, "docs/phase-18/agent-pack/ROADMAP-INDEX.md");
const denaliReadmePath = join(repoRoot, "packages/workspaces/denali/README.md");

describe("workspace-metadata-phase-exit", () => {
  it("EX-02 assessment documents score >= 9/10 with rubric dimensions", () => {
    const assessment = readFileSync(assessmentPath, "utf8");
    assert.match(assessment, /9\.[0-9]\/10|9\.0\/10|9\.1\/10|9\.2\/10|9\.3\/10|9\.4\/10|9\.5\/10|9\.6\/10|9\.7\/10|9\.8\/10|9\.9\/10|10\/10/);
    assert.match(assessment, /Metadata platform completeness/i);
    assert.match(assessment, /Denali safety/i);
    assert.match(assessment, /Cutover readiness/i);
  });

  it("EX-03 roadmap marks P3 complete", () => {
    const roadmap = readFileSync(roadmapPath, "utf8");
    assert.match(roadmap, /p3_status:\s*complete|P3 complete/i);
  });

  it("EX-03 scoped denali covenant guard passes", () => {
    const output = execFileSync("pnpm", ["run", "guard:p3-denali-covenant"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.match(output, /guard-p3-denali-covenant — PASS/);
  });

  it("EX-03 denali README maintenance banner present", () => {
    const readme = readFileSync(denaliReadmePath, "utf8");
    assert.match(readme, /Maintenance mode \(P3-D\)/);
  });
});
