/**
 * P10 pack doc integrity — v1.0 AI-agent hardened.
 * @see docs/phase-23/appendices/P10-BOOT-MANIFEST.yaml
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "../../..");
const P10_ROOT = join(ROOT, "docs/phase-23");

const P10_APPENDICES = [
  "P10-BOOT-MANIFEST.yaml",
  "P10-ANTI-HOLLOW-CONTRACT.md",
  "P10-AGENT-TURN-SCHEMA.md",
  "P10-VERIFICATION-COMMANDS.yaml",
  "P10-IMPLEMENTATION-TRUTH.md",
  "P10-EXECUTION-DISCIPLINE.md",
  "P10-DEPRECATED-ENTRYPOINTS.md",
] as const;

const NANO_KEY_RE = /^P10-[0-3]-N-[0-9]{3}:/gm;

function readP10(rel: string): string {
  return readFileSync(join(P10_ROOT, rel), "utf8");
}

describe("p10-pack-integrity", () => {
  it("P10-AGENT-01 AGENT-CURRENT-PHASE.yaml pack v1.0", () => {
    const raw = readP10("AGENT-CURRENT-PHASE.yaml");
    assert.match(raw, /^pack_version:\s+"1.0"/m);
    assert.match(raw, /^ai_agent_pack:\s+COMPLETE/m);
    assert.match(
      raw,
      /^current_task:\s+P10-[0-3]-N-\d{3}/m,
      "current_task must be a valid P10 nano"
    );
    assert.match(raw, /^fail_token:\s+P10_FAIL/m);
    assert.match(
      raw,
      /^status:\s+(PLANNED|IN_PROGRESS|BEHAVIORAL_COMPLETE)/m,
      "status must be valid"
    );
  });

  it("P10-AGENT-02 appendices exist", () => {
    for (const name of P10_APPENDICES) {
      assert.ok(existsSync(join(P10_ROOT, "appendices", name)), `missing ${name}`);
    }
  });

  it("P10-DOC-01 DOC-SYNC nano_total 16", () => {
    const raw = readP10("DOC-SYNC-INDEX.md");
    assert.match(raw, /nano_total:\s+16/);
  });

  it("P10-BOOT-01 BOOT-MANIFEST prerequisite p9:gate", () => {
    const boot = readP10("appendices/P10-BOOT-MANIFEST.yaml");
    assert.match(boot, /fail_token: P10_FAIL/);
    assert.match(boot, /pnpm run p9:gate/);
    assert.match(boot, /P9_CODE_CONSOLIDATION_GATE_OK/);
    assert.match(boot, /nano_total:\s+16/);
    assert.match(boot, /algorithm: detect_current_nano/);
  });

  it("P10-AH-01 anti-hollow forbids admin apex + Profile B deprecate", () => {
    const ah = readP10("appendices/P10-ANTI-HOLLOW-CONTRACT.md");
    assert.match(ah, /does_not_prove/);
    assert.match(ah, /admin.*custom apex|admin\.\{customer_apex\}/i);
    assert.match(ah, /Profile B|deprecate/i);
    assert.match(ah, /on_demand|on-demand/i);
    assert.match(ah, /health-check 2\/4|smoke-four-process/i);
  });

  it("P10-VC-01 verification YAML has 16 nano keys", () => {
    const vc = readP10("appendices/P10-VERIFICATION-COMMANDS.yaml");
    const keys = vc.match(NANO_KEY_RE) ?? [];
    assert.equal(keys.length, 16, `expected 16 nanos, got ${keys.length}`);
  });

  it("P10-VC-02 every nano has proof_tier + forbidden_shortcuts", () => {
    const vc = readP10("appendices/P10-VERIFICATION-COMMANDS.yaml");
    const blocks = vc.split(/^P10-[0-3]-N-[0-9]{3}:/m).slice(1);
    assert.equal(blocks.length, 16);
    for (const block of blocks) {
      assert.match(block, /proof_tier:/);
      assert.match(block, /forbidden_shortcuts:/);
      assert.match(block, /^\s+- run:/m);
    }
  });

  it("P10-TURN-01 turn schema scope_violation", () => {
    const turn = readP10("appendices/P10-AGENT-TURN-SCHEMA.md");
    assert.match(turn, /scope_violation/);
    assert.match(turn, /P10_FAIL/);
    assert.match(turn, /profile_b_regression_checked/);
  });

  it("P10-FIT-01 app-fit wildcard first + admin defer", () => {
    const fit = readP10("p10-app-fit.md");
    assert.match(fit, /wildcard|Wave A/i);
    assert.match(fit, /admin custom apex|H-P6-03/i);
    assert.match(fit, /Profile B|نگه دار|deprecate/i);
  });

  it("P10-RB-01 Wave A runbooks exist", () => {
    assert.ok(existsSync(join(P10_ROOT, "runbooks/p10-incident-four-process.md")));
    assert.ok(existsSync(join(P10_ROOT, "runbooks/p10-cert-renewal.md")));
    assert.ok(existsSync(join(P10_ROOT, "runbooks/p10-second-club-onboarding.md")));
    assert.ok(existsSync(join(P10_ROOT, "runbooks/p10-staging-domain-cutover.md")));
  });

  it("P10-GATE-01 p10:gate registered", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p10:gate"/);
    assert.match(pkg, /"p10:staging-remote-smoke"/);
    assert.ok(existsSync(join(ROOT, "scripts/p10-production-gate.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p10-staging-remote-gate.sh")));
  });

  it("P10-CADDY-01 Profile C install + port-param Caddyfile", () => {
    const caddy = readFileSync(join(ROOT, "deploy/vps/caddy/Caddyfile"), "utf8");
    assert.match(caddy, /reverse_proxy 127\.0\.0\.1:\{\$WEB_PORT\}/);
    assert.match(caddy, /reverse_proxy 127\.0\.0\.1:\{\$MARKETING_PORT\}/);
    assert.match(caddy, /reverse_proxy 127\.0\.0\.1:\{\$PORTAL_PORT\}/);
    assert.ok(existsSync(join(ROOT, "scripts/vps-deploy/install-caddy-profile-c.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/vps-deploy/render-caddy-env.sh")));
  });

  it("P10-ENV-01 P8 four-file regression script", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p10:p8-env-regression"/);
    assert.match(pkg, /"p10:profile-b-regression"/);
    assert.ok(existsSync(join(ROOT, "scripts/p10-p8-env-regression.sh")));
    for (const f of [
      "deploy/vps/env/api.env.example",
      "deploy/vps/env/web.env.example",
      "deploy/vps/env/marketing.env.example",
      "deploy/vps/env/portal.env.example",
    ]) {
      assert.ok(existsSync(join(ROOT, f)), `missing ${f}`);
    }
    const web = readFileSync(join(ROOT, "deploy/vps/env/web.env.example"), "utf8");
    assert.match(web, /SESSION_COOKIE_SECURE/);
    assert.match(web, /Profile C/i);
  });

  it("P10-BUILD-01 build:operator-vps uses vps-deploy script", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"build:operator-vps":\s*"bash scripts\/vps-deploy\/build-operator-vps\.sh"/);
    assert.ok(existsSync(join(ROOT, "scripts/vps-deploy/build-operator-vps.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/vps-deploy/rollback-vps.sh")));
  });

  it("P10-STAGING-01 staging gate script registered", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p10:staging-gate"/);
    assert.match(pkg, /"p10:vps-smoke"/);
    assert.ok(existsSync(join(ROOT, "scripts/p10-staging-gate.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p10-vps-smoke.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p10-profile-c-env-check.sh")));
    const readme = readFileSync(join(ROOT, "deploy/vps/README.md"), "utf8");
    assert.match(readme, /p10:staging-gate/i);
    assert.match(readme, /Profile B/i);
    assert.match(readme, /23000|four.process/i);
  });

  it("P10-CI-01 GHA post-deploy smoke hook", () => {
    const deploy = readFileSync(join(ROOT, ".github/workflows/deploy-vps.yml"), "utf8");
    assert.match(deploy, /smoke-four-process|p10-production-remote-gate|p10-staging-remote-gate/);
    assert.ok(existsSync(join(ROOT, ".github/workflows/p10-staging-gate.yml")));
    assert.ok(existsSync(join(ROOT, "scripts/vps-deploy/smoke-four-process.sh")));
  });

  it("P10-OPS-01 ops drill + rollback dry-run", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p10:ops-drill"/);
    assert.ok(existsSync(join(ROOT, "scripts/p10-ops-drill.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/vps-deploy/rollback-vps-dry-run.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/vps-deploy/verify-ufw-four-process.sh")));
  });

  it("P10-START-01 AGENT-START sole boot", () => {
    const start = readP10("AGENT-START.md");
    assert.match(start, /sole_boot: appendices\/P10-BOOT-MANIFEST.yaml/);
    assert.match(start, /turn_report/);
    assert.match(start, /pnpm run p9:gate/);
  });
});
