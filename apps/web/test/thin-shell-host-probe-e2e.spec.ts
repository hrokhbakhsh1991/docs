/**
 * Thin Shell Phase 4by — host-probe Playwright E2E inventory lock (no browser launch).
 * @see docs/dev/thin-shell-host-probe-e2e.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");

describe("thin-shell-host-probe-e2e — Phase 4by", () => {
  it("TS-4BY-01 runbook documents opt-in env + scenarios", () => {
    const doc = readFileSync(
      resolve(REPO_ROOT, "docs/dev/thin-shell-host-probe-e2e.mdoc"),
      "utf8"
    );
    assert.match(doc, /HOST_PROBE_E2E=1/);
    assert.match(doc, /PW_EXTERNAL_SERVERS=1/);
    assert.match(doc, /workspace-host-probe-missing-id/);
    assert.match(doc, /pluginId=acme/);
    assert.match(doc, /not\*\* wired into CI full gates|not wired into CI full gates|\*\*not\*\* wired into CI full gates/i);
    assert.match(doc, /pre-commit:fast/);
  });

  it("TS-4BY-02 playwright config is external-server only (no webServer)", () => {
    const cfg = readFileSync(resolve(WEB_ROOT, "playwright.host-probe.config.ts"), "utf8");
    assert.match(cfg, /HOST_PROBE_E2E/);
    assert.match(cfg, /PW_EXTERNAL_SERVERS/);
    assert.match(cfg, /workspace-host-probe\.spec\.ts/);
    assert.doesNotMatch(cfg, /webServer\s*:/);
  });

  it("TS-4BY-03 e2e spec covers four fail-closed / acme surfaces", () => {
    const spec = readFileSync(
      resolve(WEB_ROOT, "tests/e2e/workspace-host-probe.spec.ts"),
      "utf8"
    );
    assert.match(spec, /HOST_PROBE_E2E/);
    assert.match(spec, /workspace-host-probe-missing-id/);
    assert.match(spec, /pluginId=acme/);
    assert.match(spec, /workspace-host-probe-capability-missing/);
    assert.match(spec, /workspace-host-probe-not-found/);
    assert.match(spec, /SMK-HOST-PROBE-0[1-4]/);
  });

  it("TS-4BY-04 middleware lists /workspace-host-probe as public", () => {
    const mw = readFileSync(resolve(WEB_ROOT, "middleware.ts"), "utf8");
    assert.match(mw, /pathname === "\/workspace-host-probe"/);
  });

  it("TS-4BY-05 package.json exposes test:e2e:host-probe", () => {
    const pkg = readFileSync(resolve(WEB_ROOT, "package.json"), "utf8");
    assert.match(pkg, /"test:e2e:host-probe"\s*:\s*"playwright test -c playwright\.host-probe\.config\.ts"/);
  });
});
