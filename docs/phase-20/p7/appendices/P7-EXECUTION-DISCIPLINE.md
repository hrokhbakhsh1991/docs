# P7 — Execution discipline (no fake work)

```yaml
discipline_id: P7-EXECUTION-DISCIPLINE
pack_version: "1.6"
authority: IMPLEMENTATION-TRUTH-P7.md · AGENT-START.md
status: NORMATIVE
decision: DEC-P7-009
```

> **Rule:** P7 proves the **same VS-01..08** P6 already built — on staging with customer data. Anything else is scope creep.

---

## What P7 is (one sentence)

Staging proof + P0 fixes for the **first Denali customer tour** — not a second product build.

---

## Execution order (strict)

```text
1. P7-0 until four-process + seed + operator login work on staging
2. P7-1 walkthrough FIRST (N-001) — then fix only listed P0 blockers
3. P7-2 only after VS-01 staging (N-009) — only paths VS-06 needs
4. P7-3 T2/T3/T4 + sign-off — no new product code unless a tier fails
```

**Do not start P7-1 code** until `P7-0-N-005` is staging-green.

---

## Walkthrough-before-code (DEC-P7-009)

| Step | Action | Forbidden |
| ---- | ------ | --------- |
| 1 | Run blocker walkthrough on **staging** | Coding from memory / localhost-only |
| 2 | Record P0 vs P1 vs Z4 in runbook §Blockers | Inventing blockers not seen on staging |
| 3 | Map each P0 → **one** nano + minimal diff | Drive-by refactors |
| 4 | `pnpm run p7:gate` after each fix | Skipping P6 regression |
| 5 | Update IMPLEMENTATION-TRUTH staging column | Claiming "done" from doc alone |

If walkthrough shows a nano is **already green on staging**, mark it **SKIP** — do not "fix" it.

---

## Conditional nanos (skip by default)

| Nano | Default | Enable only when |
| ---- | ------- | ---------------- |
| P7-2-N-005 Transport roster | **SKIP** | Customer day-one needs transport tab on staging |
| P7-2-N-006 Operator register | **SKIP** | Walkthrough shows portal-only is insufficient |

Document skip in exit checklist with reason — not a failure.

---

## Forbidden patterns (agents)

```text
❌ New features not required for VS-01..08 on staging
❌ Refactors "while we're here" (Z1 freeze)
❌ Gateway, Stripe, Zibal, Urban, wizard rebuild
❌ New gate specs / smoke files before staging URLs exist
❌ In-memory finance on staging (Postgres only for T3)
❌ Duplicate seed/wizard work (one settings-seed nano covers pickers + prefill)
❌ Treating doc pack complete as P7 exit
❌ `done_doc` metrics as progress — only staging + manual columns count
```

---

## Storage truth (finance)

| Environment | Finance repository | Proof |
| ----------- | ------------------ | ----- |
| Dev / unit tests | `InMemoryFinanceRepository` OK | P6 specs |
| Staging / T3 | **Postgres / Prisma only** | `finance-ops.spec.ts` + `DATABASE_URL` |

Do not wire memory driver to staging to "unblock" — fix env instead.

---

## Minimum viable customer path

Only these must be **staging-green** for first sign-off:

| VS | Minimum proof |
| -- | ------------- |
| VS-01 | Customer tour published `active` |
| VS-02 | Marketing catalog lists tour |
| VS-03 | Portal registration creates pending booking |
| VS-04 | Member sees registration in `/me` |
| VS-05 | Member uploads receipt |
| VS-06 | Operator approves booking from workspace |
| VS-07 | Operator approves receipt (finance) |
| VS-08 | `pnpm run p7:gate` on every PR |

Everything else in the pack is **supporting**, not a new product surface.

---

## PR checklist (every change)

1. Doc-first if touching `apps/api` · `apps/web` · `packages/workspaces/denali`
2. One nano or one P0 blocker per PR
3. `pnpm run p7:gate`
4. Update `p7-exit-checklist.md` **staging** column only when proven
5. Update `IMPLEMENTATION-TRUTH-P7.md` after staging proof

---

## References

- [P7-BOOT-MANIFEST.yaml](P7-BOOT-MANIFEST.yaml)
- [P6-P7-BOUNDARY.md](P6-P7-BOUNDARY.md)
- [p7-wizard-blocker-walkthrough.md](../runbooks/p7-wizard-blocker-walkthrough.md)
- [DEC-P7-INDEX.md](DEC-P7-INDEX.md)
- [POST-P7-HORIZON.md](POST-P7-HORIZON.md)
