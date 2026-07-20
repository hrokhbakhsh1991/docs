# WP0 — DEV Reconcile Report

```yaml
doc_role: temporary_wp0_reconcile
location: TEMP/
tracked_copy: docs/phase-20/p7/appendices/STABILIZATION_WP0_DEV_RECONCILE.md
created: 2026-07-20
canonical_branch: booking/capacity-concurrency-cert
tip_at_report: f1956621
compared_to: origin/DEV @ 2f9bf664
verdict: NO_BLIND_MERGE — no required cherry-picks for the 19 DEV-only commits
```

**Companion:** [STABILIZATION_CHARTER.md](./STABILIZATION_CHARTER.md) · [STABILIZATION_WP_MATRIX.md](./STABILIZATION_WP_MATRIX.md)

---

## 1. Verdict

| Decision | Detail |
| -------- | ------ |
| Blind merge `origin/DEV` → tip | **Forbidden** (Charter / this report) |
| Cherry-pick the 19 DEV-only commits | **Not required** — all have tip message-equivalents; 15/19 are `git cherry` already-applied; remaining 4 are near-duplicates with tip-ahead context |
| Lost unique product work on DEV tip tree | **None material** — 8 DEV-only paths are legacy renames/removals superseded on tip |
| Residual process P1 | Keep `origin/DEV` as historical; do not fast-forward tip to DEV; optional later: reset DEV to tip after Architect OK |

**WP0 Done criteria:** satisfied by this report (inventory + stash policy + no-merge rule).

---

## 2. Divergence snapshot

| Metric | Value |
| ------ | ----- |
| `origin/DEV...HEAD` (left/right) | **19** behind / **66** ahead |
| Files only on `origin/DEV` | **8** |
| Files only on `HEAD` | **476** (booking/hostile/recon train tip-ahead) |
| `git cherry HEAD origin/DEV` | **15** already (`-`) / **4** marked need-pick (`+`) |

---

## 3. The 19 DEV-only commits (classification)

Legend:

- `PATCH_EQ` — stable patch-id matches tip commit with same subject  
- `NEAR_EQ` — same subject on tip; patch differs (usually tip-ahead parents / extra context)  
- `CHERRY_ALREADY` — `git cherry` marks `-` (equivalent already on tip)

| DEV SHA | Subject | Tip twin | Class |
| ------- | ------- | -------- | ----- |
| `d79a1dec` | PSC-001 cross-surface cohesion (Phases 0–4) | `09ac2b67` | PATCH_EQ / CHERRY_ALREADY |
| `d6d4f8e1` | close PSC-001 follow-up — WAC, EPH, AP15, ASB-001 | `c5f1e640` | NEAR_EQ (`+` cherry; DEV commit touched more paths at apply time) |
| `44ddd919` | path-gated pre-commit, lint-staged, test-changed | `0472f6d0` | NEAR_EQ (`+` cherry; same 6 files / same line counts) |
| `dcc347b6` | PSC surface cohesion follow-up | `046978af` | NEAR_EQ (`+` cherry; DEV also touched 3 paths tip already carries via other commits) |
| `fbdfd967` | PR path filters phase-0..7 + doc-gate | `fa21a49c` | PATCH_EQ / CHERRY_ALREADY |
| `77735973` | PCMS login egress, member UI, registration UX | `e299f151` | PATCH_EQ / CHERRY_ALREADY |
| `5beb81e1` | MKT-SKIN-01 after PCMS tour sign-in | `dd5f558f` | PATCH_EQ / CHERRY_ALREADY |
| `6def309e` | H0.1 reclaim stale HTTP idempotency rows | `340ad3e9` | NEAR_EQ (`+` cherry; tip twin +2 lines in finance.repository) |
| `c50fe798` | IDEM-RECLAIM proofs | `000bcc55` | PATCH_EQ / CHERRY_ALREADY |
| `1bf78548` | approve Pending guards + ledger insert | `981adfb6` | PATCH_EQ / CHERRY_ALREADY |
| `57f7fffc` | APPROVE-RACE + second-key proofs | `ceb7acab` | PATCH_EQ / CHERRY_ALREADY |
| `f748c8e2` | gate P5_ATOMIC_TX_TEST_ABORT to NODE_ENV=test | `fd9aa079` | PATCH_EQ / CHERRY_ALREADY |
| `c40398e7` | durable prepayment booking-sync degradation | `67477e9f` | PATCH_EQ / CHERRY_ALREADY |
| `12017d59` | require Idempotency-Key create/submit | `3ab118ca` | PATCH_EQ / CHERRY_ALREADY |
| `54bf1f71` | Phase 4B lease docs | `ebf8f6a5` | PATCH_EQ / CHERRY_ALREADY |
| `eac76eaa` | schema HTTP idempotency leases + keys | `be0d8c2a` | PATCH_EQ / CHERRY_ALREADY |
| `647f00ba` | lease reclaim ownership + business idempotency | `f3cb2cfd` | PATCH_EQ / CHERRY_ALREADY |
| `c2696c04` | lease/reclaim/payload-mismatch proofs | `4679c356` | PATCH_EQ / CHERRY_ALREADY |
| `2f9bf664` | Phase 4B residual abort/statusCode/replay | `9298e6ec` | PATCH_EQ / CHERRY_ALREADY |

### Interpretation of the four `git cherry +` rows

These are **not** “missing features.” Each has a tip twin with the same subject. Patch divergence comes from different base blobs when the cherry was applied onto the booking tip. Tip carries the finance Phase 4B lease migration (`20260718210000_finance_idempotency_lease_and_creation_keys`) and reclaim helpers (`http-idempotency-reclaim.ts`). **Do not re-cherry these four onto tip.**

---

## 4. Tree-only paths on `origin/DEV` (8 files)

| DEV-only path | Fate on tip | Action |
| ------------- | ----------- | ------ |
| `apps/api/src/denali-finance/*` (5 files) | Superseded by `workspace-finance/` (+ finance-core) | **Do not restore** |
| `workspace-finance/prisma-workspace-outbox-writer.ts` | Moved to `infrastructure/prisma-workspace-outbox-writer.ts` | **Do not restore** |
| `workspace-finance/register-workspace-finance-deps.ts` | Intentionally removed (ownership specs assert absence) | **Do not restore** |
| `bookings/booking-active-duplicate.ts` | Helpers unused on tip; uniqueness is DB unique indexes (MR-P0-011) + guest uniqueness docs | **Do not restore** unless a future ticket reintroduces app-level duplicate finder |

---

## 5. Explicit non-lost items still outside tip (separate tickets)

| Item | Location | Severity | Rule |
| ---- | -------- | -------- | ---- |
| Portal login modal WIP | `wip/portal-psc-20260718` @ `25f995c7` | P1 product | Reclaim only with explicit ticket — not part of WP0 merge |
| Large DEV stash | `stash@{3}` (~509 files) | High risk if popped | Ticket required; never auto-pop during Stabilization |
| Finance HostIo / phase-1 stashes | `stash@{0}`…`@{2}` | Medium | Ticket required |

---

## 6. Stash policy (locked)

1. **Do not** `git stash pop` / `apply` during Stabilization without an Architect-named reclaim ticket.  
2. `stash@{3}` (DEV local uncommitted, large) is **quarantined** — treat as archaeological, not merge fuel.  
3. `stash@{0}`–`@{2}` (finance / portal-psc) — same rule; compare against tip with `git stash show -p` only when ticket opens.  
4. Older `stash@{4}`–`@{9}` — historical; lowest priority.

---

## 7. Recommended follow-ups (not blocking WP0)

1. After Stabilization WP-GATE: optionally move `origin/DEV` pointer to tip (or open PR tip→DEV) so dual tips die — **Architect YES**.  
2. WP4/WP5 only if build/boundary blockers appear (tip currently clean after `f1956621`).  
3. Portal modal reclaim = separate product ticket off `wip/portal-psc-20260718`.

---

## 8. Commands used

```bash
git fetch origin
git rev-list --left-right --count origin/DEV...HEAD
git log --oneline HEAD..origin/DEV
git cherry -v HEAD origin/DEV
# per-commit: patch-id compare DEV ↔ tip twin by subject
comm -23 <(git ls-tree -r --name-only origin/DEV | sort) \
         <(git ls-tree -r --name-only HEAD | sort)
```

---

*WP0 complete. Do not merge DEV. Next Stabilization step: WP4/WP5 only if blockers; else approach WP-GATE checklist.*
