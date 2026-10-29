import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import Reporter from "./fixtures/two-tenant-staging-result-reporter.mjs";

async function writeReport(
  results: Array<{ status: string; attachments?: Array<{ name: string; path?: string }> }>,
  finalStatus: string,
  expected = results.length
) {
  const root = mkdtempSync(join(tmpdir(), "two-tenant-report-"));
  const outputDir = join(root, "run");
  mkdirSync(outputDir);
  const reporter = new Reporter({
    runId: "fixture-run",
    runtimeSha: "a".repeat(40),
    testSha: "b".repeat(40),
    tenantLabels: ["A", "B"],
    outputDir,
  });
  reporter.onBegin({}, { allTests: () => Array.from({ length: expected }) });
  for (const result of results) reporter.onTestEnd({}, result);
  await reporter.onEnd({ status: finalStatus });
  const report = JSON.parse(readFileSync(join(outputDir, "result.json"), "utf8"));
  return { root, outputDir, report };
}

describe("two-tenant staging result reporter", () => {
  it("writes PASS only when all planned checks passed", async () => {
    const { root, report } = await writeReport(
      [{ status: "passed" }, { status: "passed" }],
      "passed"
    );
    try {
      assert.equal(report.status, "PASS");
      assert.equal(report.counts.planned, 2);
      assert.equal(report.counts.passed, 2);
      assert.equal(report.runtimeSha, "a".repeat(40));
      assert.equal(report.testSha, "b".repeat(40));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("records failures and only in-directory screenshot or trace references", async () => {
    const root = mkdtempSync(join(tmpdir(), "two-tenant-artifacts-"));
    const outputDir = join(root, "run");
    mkdirSync(outputDir);
    const screenshot = join(outputDir, "failure.png");
    const trace = join(outputDir, "trace.zip");
    const outside = join(root, "outside.png");
    for (const path of [screenshot, trace, outside]) writeFileSync(path, "placeholder");
    const reporter = new Reporter({
      runId: "fixture-run",
      runtimeSha: "a".repeat(40),
      testSha: "b".repeat(40),
      tenantLabels: ["A", "B"],
      outputDir,
    });
    reporter.onBegin({}, { allTests: () => [{}] });
    reporter.onTestEnd(
      { title: "sensitive test title" },
      {
        status: "failed",
        attachments: [
          { name: "screenshot", path: screenshot },
          { name: "trace", path: trace },
          { name: "screenshot", path: outside },
          { name: "debug-token", path: trace },
        ],
      }
    );
    await reporter.onEnd({ status: "failed" });
    try {
      const raw = readFileSync(join(outputDir, "result.json"), "utf8");
      const report = JSON.parse(raw);
      assert.equal(report.status, "FAIL");
      assert.deepEqual(report.artifacts, [
        { kind: "screenshot", path: "failure.png" },
        { kind: "trace", path: "trace.zip" },
      ]);
      assert.equal(raw.includes("sensitive test title"), false);
      assert.equal(raw.includes("debug-token"), false);
      assert.equal(raw.includes("outside.png"), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports NOT RUN for skipped or incomplete checks", async () => {
    const skipped = await writeReport([{ status: "skipped" }], "passed");
    const incomplete = await writeReport(
      [{ status: "passed" }, { status: "skipped" }],
      "passed",
      2
    );
    const interrupted = await writeReport([{ status: "passed" }], "interrupted", 2);
    try {
      assert.equal(skipped.report.status, "NOT RUN");
      assert.equal(incomplete.report.status, "NOT RUN");
      assert.equal(incomplete.report.counts.planned, 2);
      assert.equal(incomplete.report.counts.completed, 2);
      assert.equal(interrupted.report.status, "FAIL");
    } finally {
      rmSync(skipped.root, { recursive: true, force: true });
      rmSync(incomplete.root, { recursive: true, force: true });
      rmSync(interrupted.root, { recursive: true, force: true });
    }
  });
});
