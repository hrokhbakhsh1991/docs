import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

const SCHEMA_VERSION = 1;

function safeArtifactReference(filePath, outputDir) {
  if (typeof filePath !== "string" || filePath.length === 0) return null;
  const absolutePath = resolve(filePath);
  const root = resolve(outputDir);
  const rel = relative(root, absolutePath);
  if (
    rel === "" ||
    rel.startsWith(`..${sep}`) ||
    rel === ".." ||
    resolve(root, rel) !== absolutePath
  ) {
    return null;
  }
  return rel.split(sep).join("/");
}

export default class TwoTenantStagingResultReporter {
  constructor(options) {
    this.options = options;
    this.startedAt = null;
    this.expected = 0;
    this.counts = { passed: 0, failed: 0, skipped: 0, timedOut: 0, interrupted: 0, other: 0 };
    this.artifacts = [];
  }

  onBegin(_config, suite) {
    this.startedAt = new Date().toISOString();
    this.expected = suite.allTests().length;
  }

  onTestEnd(_test, result) {
    if (result.status === "passed") this.counts.passed += 1;
    else if (result.status === "failed") this.counts.failed += 1;
    else if (result.status === "skipped") this.counts.skipped += 1;
    else if (result.status === "timedOut") this.counts.timedOut += 1;
    else if (result.status === "interrupted") this.counts.interrupted += 1;
    else this.counts.other += 1;

    for (const attachment of result.attachments ?? []) {
      if (attachment.name !== "screenshot" && attachment.name !== "trace") continue;
      const path = safeArtifactReference(attachment.path, this.options.outputDir);
      if (path !== null) this.artifacts.push({ kind: attachment.name, path });
    }
  }

  async onEnd(fullResult) {
    const endedAt = new Date().toISOString();
    const completed =
      this.counts.passed +
      this.counts.failed +
      this.counts.skipped +
      this.counts.timedOut +
      this.counts.interrupted +
      this.counts.other;
    const failed =
      this.counts.failed > 0 ||
      this.counts.timedOut > 0 ||
      this.counts.interrupted > 0 ||
      this.counts.other > 0 ||
      fullResult.status !== "passed";
    const status = failed
      ? "FAIL"
      : this.expected > 0 &&
          completed === this.expected &&
          this.counts.passed === this.expected &&
          fullResult.status === "passed"
        ? "PASS"
        : "NOT RUN";
    const report = {
      schemaVersion: SCHEMA_VERSION,
      runId: this.options.runId,
      runtimeSha: this.options.runtimeSha,
      testSha: this.options.testSha,
      tenantLabels: [...this.options.tenantLabels],
      status,
      startedAt: this.startedAt,
      endedAt,
      counts: { planned: this.expected, completed, ...this.counts },
      artifacts: this.artifacts,
    };
    const outputPath = resolve(this.options.outputDir, "result.json");
    await mkdir(dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporaryPath, outputPath);
  }
}
