# P10 Agent — sole entry (pack v1.0 AI-hardened)

```yaml
phase: 23
pack: P10
pack_version: "1.0"
status: PLANNED
sole_boot: appendices/P10-BOOT-MANIFEST.yaml
fail_token: P10_FAIL
prerequisite: P9 exit · pnpm run p9:gate
current_task: P10-1-N-001
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/P10-IMPLEMENTATION-TRUTH.md
anti_hollow: appendices/P10-ANTI-HOLLOW-CONTRACT.md
verification: appendices/P10-VERIFICATION-COMMANDS.yaml
turn_schema: appendices/P10-AGENT-TURN-SCHEMA.md
discipline: appendices/P10-EXECUTION-DISCIPLINE.md
profile: p10-production-profile.yaml
app_fit: p10-app-fit.md
p10_gate: pnpm run p10:gate
exit_target: 8.7
```

> **Agents:** Boot **only** from [P10-BOOT-MANIFEST.yaml](appendices/P10-BOOT-MANIFEST.yaml). Caddyfile in repo ≠ HTTPS on staging.

---

## Pre-flight (T0 — every session)

```text
1. READ  appendices/P10-BOOT-MANIFEST.yaml
2. READ  p10-app-fit.md (wildcard first · admin apex defer · Profile B kept)
3. READ  p10-production-profile.yaml
4. READ  appendices/P10-IMPLEMENTATION-TRUTH.md
5. READ  appendices/P10-ANTI-HOLLOW-CONTRACT.md
6. READ  appendices/P10-EXECUTION-DISCIPLINE.md
7. READ  AGENT-CURRENT-PHASE.yaml
8. RUN    pnpm run p9:gate  (exit 0 or P10_FAIL)
9. LOAD   P10-VERIFICATION-COMMANDS.yaml#{current_task} only
10. END   turn with turn_report
```

---

## What P10 is

**Production-grade ops** — TLS edge · CI smoke 4/4 · incident/DR runbooks · Profile C staging HTTPS.

**Not:** P9 code dedup · admin custom apex exit · deprecate Profile B · SMS/k8s prometheus gates.

| EPIC | One line |
| ---- | -------- |
| P10-1 | Caddy wildcard + loopback + cookie/headers |
| P10-2 | smoke 4/4 · GHA · env regression · build align |
| P10-3 | Runbooks · rollback · README · p10:gate |
| P10-0 | M+P custom apex · on-demand TLS (Wave C) |

---

## Agent loop

```text
detect_current_nano
  → doc-first if deploy/vps or apps/api TLS
  → LOAD verification YAML#nano only
  → RUN commands · expect_token
  → pnpm run p10:gate if pack/deploy touched
  → UPDATE IMPLEMENTATION-TRUTH on PROFILE_C/OPS PASS
  → EMIT turn_report (mandatory)
```

---

## Gates

```bash
pnpm run p9:gate     # prerequisite every session
pnpm run p10:gate    # after any P10 touch
bash scripts/vps-deploy/smoke-four-process.sh   # when exists + edge live
pnpm run p7:staging-verify                      # M+P fail-closed after P10-2-N-005
```

---

## Forbidden (P10_FAIL)

```text
❌ Start before p9:gate green
❌ on_demand_tls before wildcard staging HTTPS
❌ admin.{customer_apex} as P10 exit requirement
❌ Deprecate Profile B IP in deploy docs
❌ health-check 2/4 as exit sufficient
❌ Require live second production customer
❌ SMS · k8s prometheus as P10 infra gates
❌ Public https://api.* mandatory
❌ Claim exit from p10:gate without Profile C smoke
❌ Re-implement P8 env when P8 closed (regression only)
```

---

## Wave A first sprint

| Nano | Gap | One line |
| ---- | --- | -------- |
| P10-1-N-001 | G-TLS-01/02 | Caddy wildcard + loopback |
| P10-2-N-001 | G-DEP-01 | smoke-four-process 4/4 |
| P10-2-N-002 | G-DEP-02 | GHA post-deploy smoke |
| P10-3-N-001 | G-OPS-01 | Incident runbook 4 units |

---

## Status

**Current nano:** `P10-1-N-001` · [AGENT-CURRENT-PHASE.yaml](AGENT-CURRENT-PHASE.yaml)

See also: [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) · [../POST-P7-PACK-ALIGNMENT.md](../POST-P7-PACK-ALIGNMENT.md)
