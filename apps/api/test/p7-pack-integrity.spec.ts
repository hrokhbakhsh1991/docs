/**
 * P7 pack doc integrity — v1.6 AI-agent hardened.
 * @see docs/phase-20/p7/appendices/P7-BOOT-MANIFEST.yaml
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(import.meta.dirname, "../../..");
const P7_ROOT = join(ROOT, "docs/phase-20/p7");

const P7_APPENDICES = [
  "P6-P7-BOUNDARY.md",
  "PAYMENT-LEDGER-BOUNDARY.md",
  "IMPLEMENTATION-TRUTH-P7.md",
  "P7-EXECUTION-DISCIPLINE.md",
  "P7-PORT-MATRIX.md",
  "P7-CUSTOMER-SEED-DELTA.md",
  "P7-HOST-PARITY-PROFILE-B.md",
  "P7-FINANCE-PATH-BOUNDARY.md",
  "P7-EXIT-CRITERIA-98.md",
  "P7-EVIDENCE-PACK.md",
  "P7-BOOT-MANIFEST.yaml",
  "P7-ANTI-HOLLOW-CONTRACT.md",
  "P7-AGENT-TURN-SCHEMA.md",
  "P7-DEPRECATED-ENTRYPOINTS.md",
  "P7-VERIFICATION-COMMANDS.yaml",
  "P7-TEST-INVENTORY.md",
  "P7-DOC-ARCHITECTURE.md",
  "DEC-P7-INDEX.md",
  "PACK-EXTENSION-GUIDE.md",
  "TRACEABILITY-MATRIX-P7.md",
  "SMOKE-SCENARIO-MAP-P7.md",
  "POST-P7-HORIZON.md",
] as const;

const P7_RUNBOOKS = [
  "p7-0-staging-walkthrough.md",
  "p7-0-local-stack.md",
  "p7-0-env-matrix.md",
  "p7-wizard-blocker-walkthrough.md",
  "p7-customer-sign-off.md",
  "p7-staging-e2e.md",
  "p7-staging-e2e-ci.md",
  "p7-incident-staging.md",
  "p7-staging-gate.md",
  "p7-sms-otp-staging.md",
  "p7-receipt-minio-staging.md",
  "p7-staging-triage.md",
  "p7-staging-rollback.md",
  "p7-preservation-gate.md",
  "p7-t4-sign-off-session.md",
] as const;

const NANO_KEY_RE = /^P7-[0-3]-N-[0-9]{3}:/gm;

function readP7(rel: string): string {
  return readFileSync(join(P7_ROOT, rel), "utf8");
}

describe("p7-pack-integrity", () => {
  it("P7-AGENT-01 AGENT-CURRENT-PHASE.yaml pack v1.6", () => {
    const boot = readP7("appendices/P7-BOOT-MANIFEST.yaml");
    const bootTask = boot.match(/^current_task:\s+(P7-[0-3]-N-[0-9]{3})/m)?.[1];
    assert.ok(bootTask, "BOOT-MANIFEST current_task missing");
    const raw = readP7("AGENT-CURRENT-PHASE.yaml");
    assert.match(raw, /^status:\s+(IN_PROGRESS|STAGING_COMPLETE|BEHAVIORAL_COMPLETE)/m);
    assert.match(raw, /^pack_version:\s+"1.6"/m);
    assert.match(raw, /^ai_agent_pack:\s+COMPLETE/m);
    assert.match(raw, /^doc_quality_target:\s+"98\+ai"/m);
    // Allow null current_task when BEHAVIORAL_COMPLETE
    const statusMatch = raw.match(/^status:\s+(\w+)/m);
    if (statusMatch?.[1] === "BEHAVIORAL_COMPLETE") {
      assert.match(raw, /^current_task:\s+(null|P7-[0-3]-N-[0-9]{3})/m);
    } else {
      assert.match(raw, new RegExp(`^current_task:\\s+${bootTask.replace(/-/g, "\\-")}`, "m"));
    }
  });

  it("P7-AGENT-02 appendices exist", () => {
    for (const name of P7_APPENDICES) {
      assert.ok(existsSync(join(P7_ROOT, "appendices", name)), `missing ${name}`);
    }
  });

  it("P7-RB-01 operational runbooks exist", () => {
    for (const name of P7_RUNBOOKS) {
      assert.ok(existsSync(join(P7_ROOT, "runbooks", name)), `missing ${name}`);
    }
  });

  it("P7-DOC-01 DOC-SYNC pack_version 1.6", () => {
    const raw = readP7("DOC-SYNC-INDEX.md");
    assert.match(raw, /nano_total:\s+27/);
    assert.match(raw, /pack_version:\s+"1.6"/);
  });

  it("P7-DOC-02 DEC-P7-015 + truth ai pack", () => {
    const dec = readP7("appendices/DEC-P7-INDEX.md");
    assert.match(dec, /DEC-P7-015/);
    const truth = readP7("appendices/IMPLEMENTATION-TRUTH-P7.md");
    assert.match(truth, /ai_agent_pack: COMPLETE/);
    assert.match(truth, /doc_quality_target: "98\+ai"/);
    assert.match(truth, /P7-BOOT-MANIFEST.yaml/);
  });

  it("P7-BOOT-01 BOOT-MANIFEST boot_sequence_T0 >= 4 steps", () => {
    const boot = readP7("appendices/P7-BOOT-MANIFEST.yaml");
    assert.match(boot, /fail_token: P7_FAIL/);
    assert.match(boot, /boot_sequence_T0:/);
    const steps = boot.match(/^\s+- step:/gm);
    assert.ok(steps && steps.length >= 4, "boot_sequence_T0 needs >= 4 steps");
    assert.match(boot, /detect_current_nano:/);
  });

  it("P7-AH-01 anti-hollow p7:gate does_not_prove staging", () => {
    const ah = readP7("appendices/P7-ANTI-HOLLOW-CONTRACT.md");
    assert.match(ah, /does_not_prove/);
    assert.match(ah, /pnpm run p7:gate/);
    assert.match(ah, /Staging VS/);
    assert.match(ah, /fail_token: P7_FAIL/);
  });

  it("P7-VC-01 verification YAML has 27 nano keys", () => {
    const vc = readP7("appendices/P7-VERIFICATION-COMMANDS.yaml");
    const keys = vc.match(NANO_KEY_RE) ?? [];
    assert.equal(keys.length, 27, `expected 27 nanos, got ${keys.length}`);
  });

  it("P7-VC-02 every nano has proof_tier + command or manual ref", () => {
    const vc = readP7("appendices/P7-VERIFICATION-COMMANDS.yaml");
    const blocks = vc.split(/^P7-[0-3]-N-[0-9]{3}:/m).slice(1);
    assert.equal(blocks.length, 27);
    for (const block of blocks) {
      assert.match(block, /proof_tier:/);
      const hasCommand = /^\s+- run:/m.test(block);
      const hasManual =
        /manual_runbook_ref:/.test(block) || /manual_steps:/.test(block);
      assert.ok(hasCommand || hasManual, "nano needs commands or manual_runbook_ref/manual_steps");
    }
  });

  it("P7-TRACE-01 traceability uses verify_ref (canonical YAML)", () => {
    const trace = readP7("appendices/TRACEABILITY-MATRIX-P7.md");
    assert.match(trace, /verify_ref/);
    assert.match(trace, /P7-VERIFICATION-COMMANDS.yaml/);
    assert.doesNotMatch(trace, /\|\s*staging manual\s*\|/);
  });

  it("P7-TURN-01 turn schema references fail_token", () => {
    const turn = readP7("appendices/P7-AGENT-TURN-SCHEMA.md");
    assert.match(turn, /fail_token: P7_FAIL/);
    assert.match(turn, /turn_report:/);
    assert.match(turn, /staging_column_updated/);
  });

  it("P7-DRIFT-01 no stale pack_version 1.4 or 1.5 in p7 pack headers", () => {
    const scan = (dir: string) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === "evidence") continue;
          scan(p);
          continue;
        }
        if (!/\.(md|yaml|mdoc)$/.test(ent.name)) continue;
        const raw = readFileSync(p, "utf8");
        if (/pack_version:\s+"1\.[45]"/.test(raw)) {
          assert.fail(`stale pack_version in ${p}`);
        }
      }
    };
    scan(P7_ROOT);
  });

  it("P7-GATE-01 staging + evidence + T4 scripts registered", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf8");
    assert.match(pkg, /"p7:staging-gate"/);
    assert.match(pkg, /"p7:staging-e2e-probe"/);
    assert.match(pkg, /"p7:staging-seed-bundle"/);
    assert.match(pkg, /"p7:t4-architect-dry-run"/);
    assert.match(pkg, /"p7:t4-session-brief"/);
    assert.match(pkg, /"p7:t4-closeout"/);
    assert.match(pkg, /"p7:evidence-pack-verify"/);
    assert.ok(existsSync(join(ROOT, "scripts/p7-staging-gate.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p7-staging-e2e-probe.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p7-staging-seed-bundle.sh")));
    assert.match(pkg, /"p7:t4-ready"/);
    assert.match(pkg, /"p7:t4-prep"/);
    assert.ok(existsSync(join(ROOT, "scripts/p7-t4-prep.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p7-t4-ready.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p7-t4-session-brief.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p7-t4-day.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p7-t4-closeout.sh")));
    assert.ok(existsSync(join(ROOT, "scripts/p7-evidence-pack-verify.sh")));
  });

  it("P7-CTX-01 AGENT-CONTEXT is redirect stub", () => {
    const ctx = readP7("AGENT-CONTEXT.md");
    assert.match(ctx, /DEPRECATED/);
    assert.match(ctx, /P7_FAIL/);
    assert.match(ctx, /AGENT-START.md/);
  });

  it("P7-INFRA-01 four-process systemd templates exist", () => {
    for (const unit of ["app-tour-marketing.service", "app-tour-portal.service"]) {
      assert.ok(existsSync(join(ROOT, "deploy/vps/systemd", unit)));
    }
  });
});
