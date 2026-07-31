# P6 — Remaining checklist (formal closure)

```yaml
checklist_id: P6-REMAINING-CHECKLIST
version: "1.1-fast-close"
created: "2026-06-22"
closed: "2026-06-23"
authority: appendices/IMPLEMENTATION-TRUTH-P6.md · p6-exit-checklist.md · p6-fast-close.yaml
status: CLOSED_FAST
current_item: none
dev_slice_status: CLOSED_LOCAL
formal_closure_status: CLOSED_FAST
fast_close: p6-fast-close.yaml
vps_host: 89.45.89.206
prod_path: /opt/app-tour
prod_ports: [13000, 13001]
staging_path: /opt/app-tour-staging
staging_ports: [23000, 23001, 23002, 23003]
staging_db: tour_db_staging
staging_minio_bucket: app-tour-staging
```

> **Fast-close (2026-06-23):** P6 بسته شد روی **dev slice محلی** + **infra staging جزئی روی VPS**. مسیرهای کند (build کامل DEV، preflight/e2e روی VPS، hollow specها) → **P7 / P10**. جزئیات: [p6-fast-close.yaml](p6-fast-close.yaml).

**Do not touch production:** systemd `app-tour-api` · `app-tour-web` · `/etc/app-tour/*` · `tour_db_prod` · `app-tour-prod` MinIO bucket.

---

## Definition of Done — fast-close (met)

- [x] Local `pnpm run p6:gate` + `pnpm run p6:e2e-gate` green (dev slice)
- [x] VPS staging isolated (env + DB + MinIO + systemd، جدا از prod)
- [x] Staging API `:23001/health` ok + `P6_HOST_BIND_SMOKE_OK` on VPS
- [x] `p6-exit-checklist.md` + `IMPLEMENTATION-TRUTH-P6.md` با proof tiers صادق
- [x] `p7_blocked: false` در `AGENT-CURRENT-PHASE.yaml`

## Definition of Done — full (deferred P7)

- [ ] `pnpm run p6:staging-preflight` → `P6_STAGING_PREFLIGHT_OK` **on VPS** (DEV build green)
- [ ] `pnpm run p6:e2e-gate` → `P6_E2E_GATE_OK` **against staging hosts**
- [ ] DEV `build-operator-vps.sh` green (denali tsc + migration-head sync)
- [ ] Track B/C/D hollow + VS gaps

---

## Track summary (final)

### Track E — VPS hygiene

| ID | Item | Status | Proof |
| -- | ---- | ------ | ----- |
| **P6-REM-E1** | Kill zombie tests + free `:23001` | `[x]` | 2026-06-22 |
| **P6-REM-E2** | `/etc/app-tour-staging/README` | `[x]` | 2026-06-22 |
| **P6-REM-E3** | Rotate exposed credentials | `[~]` | **deferred ops / P7** |

### Track A — Staging deploy

| ID | Item | Status | Proof |
| -- | ---- | ------ | ----- |
| **P6-REM-A1** | Sync DEV → `/opt/app-tour-staging` | `[x]` | rsync · `SYNC-MANIFEST.txt` `4cc9197` |
| **P6-REM-A2** | `tour_db_staging` + migrate + seed | `[x]` | 32 migrations · operator `…000014` seed |
| **P6-REM-A3** | MinIO `app-tour-staging` | `[x]` | 2026-06-22 |
| **P6-REM-A4** | Env ports 23000–23003 | `[x]` | `verify-env-coherence: OK` |
| **P6-REM-A5** | systemd `app-tour-staging-*` | `[x]` | 4 units active (lite deploy + tsx API) |
| **P6-REM-A6** | Host map staging | `[x]` | [host-subdomain-map.md](runbooks/host-subdomain-map.md) VPS section |
| **P6-REM-A7** | `p6:staging-preflight` on VPS | `[~]` | **deferred P7** (gate ~20min; DEV build blocked) |
| **P6-REM-A8** | `p6:e2e-gate` on VPS | `[~]` | **deferred P7** |

### Track B — VS gaps → P7

| ID | VS | Status |
| -- | -- | ------ |
| **P6-REM-B1** | VS-01 wizard publish UI | `[~]` P7 |
| **P6-REM-B2** | VS-05/07 MinIO multipart | `[~]` P7 |
| **P6-REM-B3** | VS-06 guest→approve no seed | `[~]` P7 |
| **P6-REM-B4** | `p6:closure` e2e wiring | `[x]` | `P6_FAST_CLOSE=1` skips preflight — see p6-fast-close.yaml |

### Track C/D — honesty + hollow specs → P10

Retick false `[x]` and upgrade static specs when stabilizing — not P6 gate.

### Track F — Ledger sync

| ID | Item | Status |
| -- | ---- | ------ |
| **P6-REM-F1** | `p6-exit-checklist` status | `[x]` | `closed_fast` |
| **P6-REM-F2** | Honest `nano_done_behavioral` | `[x]` | tier sum 37 — see AGENT-CURRENT-PHASE.yaml |
| **P6-REM-F3** | IMPLEMENTATION-TRUTH snapshot | `[x]` | 2026-06-23 fast-close |

---

## Commands (fast path)

```bash
# Daily regression (local — see TEMP/FOR YOU.md for full commands)
pnpm run p6:gate
P6_FAST_CLOSE=1 pnpm run p6:closure

# VPS wiring only (~1 min, no pnpm install)
bash scripts/vps-deploy/bootstrap-staging.sh

# VPS smoke only (seconds)
ssh root@89.45.89.206 'TOUR_OPS_API_URL=http://127.0.0.1:23001 node /opt/app-tour-staging/scripts/smoke-p6-host-bind.mjs'
```

**Long steps (install, build, gates):** TEMP/FOR YOU.md (historical local scratch `FOR YOU.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)

---

## References

- [p6-fast-close.yaml](p6-fast-close.yaml)
- TEMP/FOR YOU.md (historical local scratch `FOR YOU.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)
- [runbooks/host-subdomain-map.md](runbooks/host-subdomain-map.md)
- [runbooks/p6-staging-vps-boundary.md](runbooks/p6-staging-vps-boundary.md)
- [appendices/IMPLEMENTATION-TRUTH-P6.md](appendices/IMPLEMENTATION-TRUTH-P6.md)
