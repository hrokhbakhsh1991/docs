# P9 exit checklist (strict v1.2 — app-fit aligned)

```yaml
pack: P9
phase: 22
status: PLANNED
prerequisite: P8 complete (all Wave A P0)
audit: p9-code-consolidation-audit.md
app_fit: p9-app-fit.md
target_score: 8.7
strict_baseline_composite: 3.2
```

---

## Score gate (must pass)

| Axis | Baseline | Exit min (fit) |
| ---- | -------: | -------------: |
| Guest bootstrap (M+P) | 3.0 | **≥ 9** |
| Surface boundary | 3.5 | **≥ 9** |
| Auth/BFF dedup | 2.0 | **≥ 8.5** |
| Package architecture | 4.0 | **≥ 8.5** |
| Composite | 3.2 | **≥ 8.7** |

Re-score using [p9-code-consolidation-audit.md](p9-code-consolidation-audit.md) rubric.

---

## Wave A — P0 gaps → nanos

- [x] G-BOOT-01 M+P → guest-surface-host — **P9-0-N-001**
- [x] G-BOOT-02 Single PHASE_43_HOST_TENANT_IDS — **P9-0-N-001**
- [x] G-BOOT-03 No hostname pluginId hack — **P9-2-N-001**
- [x] G-SURF-01 web public-auth deleted — **P9-1-N-001** ✅ 2026-06-23
- [x] G-SURF-02 orphan flow deleted — **P9-1-N-002**
- [x] G-AUTH-02..03 session-client — **P9-0-N-002**
- [x] G-PKG-01 guest-surface-host shipped — **P9-0-N-001**

---

## Wave B — P1 → nanos

- [ ] G-BOOT-04 isDevGuestHostAllowed M+P — **P9-0-N-003**
- [x] G-SURF-03..05 catalog bootstrap removed (redirects kept) — **P9-1-N-003**
- [x] G-AUTH-04..06 portal-only modules — **P9-1-N-004**
- [x] G-PKG-02 guard:p9-surface-boundary — **P9-3-N-001**
- [x] G-BOOT-07 web → tenant-kernel — **P9-0-N-006**

---

## Wave C → nanos

- [x] G-SURF-06 public-catalog.md portal-only — **P9-3-N-002**
- [x] G-SURF-07 e2e portal-only — **P9-3-N-003**
- [x] `pnpm run p9:gate` — **P9-3-N-005**

**Out of P9:** G-PKG-04 tenant_domains → **P10** G-ING-04b

---

## Smoke / regression gates

- [ ] Portal OTP registration e2e green
- [ ] Marketing catalog browse green
- [ ] Operator login web :3000 unaffected
- [ ] web `/catalog/*` redirect shims still 307 to M/P
- [ ] `pnpm run guard:import-boundary` PASS
- [ ] `pnpm run p7:gate` + `pnpm run p8:gate` regression
- [ ] `rg "app/api/public-auth" apps/web` → zero route.ts
- [ ] `rg "resolve-host-tenant" apps/marketing apps/portal` → zero

---

## Boundary sign-off

- [ ] PKG-01 web operator-only — no guest BFF
- [ ] PKG-02 portal sole public-auth owner
- [ ] PKG-03 M+P import guest-surface-host only (web must NOT)
- [ ] PKG-04 no app-to-app imports

| Role | Date | Signature |
| ---- | ---- | --------- |
| Architect | | |
| Platform lead | | |

---

## References

- [AGENT-START.md](AGENT-START.md)
- [appendices/P9-IMPLEMENTATION-TRUTH.md](appendices/P9-IMPLEMENTATION-TRUTH.md)
- [p9-app-fit.md](p9-app-fit.md)
