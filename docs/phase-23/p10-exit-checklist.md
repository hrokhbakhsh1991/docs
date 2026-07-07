# P10 exit checklist (strict v1.2 — app-fit aligned)

```yaml
pack: P10
phase: 23
status: PLANNED
prerequisite: P9 complete
audit: p10-production-grade-audit.md
app_fit: p10-app-fit.md
target_score: 8.7
strict_baseline_composite: 3.4
profile: p10-production-profile.yaml
```

---

## Score gate (must pass)

| Axis | Baseline | Exit min (fit) |
| ---- | -------: | -------------: |
| TLS / reverse-proxy | 1.5 | **≥ 8.5** |
| Deploy / CI | 4.0 | **≥ 9** |
| Ops | 3.0 | **≥ 8.5** |
| Env coherence | 3.5 | **≥ 9** |
| Custom domain (M+P) | 5.0 | **≥ 8** |
| Composite | 3.4 | **≥ 8.7** |

Re-score using [p10-production-grade-audit.md](p10-production-grade-audit.md).

---

## Wave A — P0 gaps (all required)

| Nano | Gap | Check |
| ---- | --- | ----- |
| P10-1-N-001 | G-TLS-01/02/04/09 | Caddy wildcard + Profile C staging HTTPS + loopback |
| P10-2-N-001 | G-DEP-01/09 | health-check + smoke-four-process 4/4 |
| P10-2-N-002 | G-DEP-02 | GHA or remote post-deploy smoke |
| P10-3-N-001 | G-OPS-01 | Incident runbook 4 units |

- [ ] P10-1-N-001 G-TLS-01/02 Caddy template + Profile C staging HTTPS (wildcard subdomain)
- [ ] P10-1-N-001 G-TLS-04 Loopback bind behind edge (Profile C mode documented)
- [ ] P10-2-N-001 G-DEP-01 health-check + smoke cover all 4 processes
- [ ] P10-2-N-002 G-DEP-02 GHA or remote post-deploy four-process smoke
- [ ] P10-3-N-001 G-OPS-01 Four-process incident runbook published

---

## Wave B — P1 gaps

| Nano | Gap | Check |
| ---- | --- | ----- |
| P10-1-N-002 | G-TLS-05/07 | forwarded-proto + SESSION_COOKIE_SECURE |
| P10-2-N-003 | G-DEP-03 | build:operator-vps aligned |
| P10-2-N-004 | G-DEP-04/05 | P8 env regression (not re-implement) |
| P10-2-N-005 | G-DEP-06 | p7-staging-verify M+P fail-closed |
| P10-0-N-001 | G-DOM-02 | M+P custom apex path |
| P10-3-N-002 | G-TLS-06 | cert renewal runbook |
| P10-3-N-003 | G-DEP-10 | rollback-vps.sh idempotent |

- [ ] P10-1-N-002 G-TLS-05/07 HTTPS forwarded headers (loopback trust) + SESSION_COOKIE_SECURE smoke
- [ ] P10-2-N-003 G-DEP-03 package.json build:operator-vps aligned
- [ ] P10-2-N-004 G-DEP-04/05 **P8 exit verified** (bootstrap 4 env + verify `--all`) — P10 extends Profile C only if gap remains
- [ ] P10-2-N-005 G-DEP-06 p7-staging-verify M+P fail-closed
- [ ] P10-0-N-001 G-DOM-02 M+P custom apex SSL path (staging wildcard proven first)
- [ ] P10-3-N-002 G-TLS-06 cert renewal runbook
- [ ] P10-3-N-003 G-DEP-10 rollback-vps.sh idempotent

**Out of Wave B exit:** G-DOM-01 admin custom apex (trunk v2) · G-DOM-03 SMS (waiver)

---

## Wave C — P2+

| Nano | Gap | Check |
| ---- | --- | ----- |
| P10-0-N-002 | G-TLS-03/10 | on_demand_tls ask |
| P10-0-N-003 | G-DOM-04 | second club runbook |
| P10-2-N-006 | G-DOM-05 | custom domain E2E M+P |
| P10-3-N-005 | G-DEP-08 | README Profile C |
| P10-3-N-006 | — | p10:gate + pack integrity |

- [ ] P10-0-N-002 G-TLS-03 on_demand_tls ask (verified hostnames)
- [ ] P10-0-N-003 G-DOM-04 Second club onboarding runbook + staging proof
- [ ] P10-2-N-006 G-DOM-05 Custom domain HTTPS E2E (M+P)
- [ ] P10-3-N-005 G-DEP-08 README Profile C + four-process first
- [ ] P10-3-N-006 `pnpm run p10:gate` green

---

## Production smoke gates (fit-aligned)

- [ ] `https://{club}.{staging_root}` marketing tenant-context OK
- [ ] `https://{club}.portal.{staging_root}` portal OK
- [ ] `https://{club}.admin.{staging_root}/auth/login` operator 2xx
- [ ] API `/health` via `127.0.0.1:3001` (not required public api.*)
- [ ] `smoke-four-process.sh` green post-deploy
- [ ] Profile B IP smoke still documented (no regression)

**NOT required for exit:** live second production customer · admin custom apex · SMS provider

---

## Ops sign-off

- [ ] INC-01 Unit down — journalctl / restart order (4 units)
- [ ] INC-02 Cert expiry — renewal checklist
- [ ] INC-03 Rollback — git SHA + four units
- [ ] INC-04 Postgres unavailable playbook
- [ ] G-OPS-03 k8s prometheus — **signed VPS waive**

| Role | Date | Signature |
| ---- | ---- | --------- |
| Architect | | |
| Ops lead | | |

---

## References

- [p10-app-fit.md](p10-app-fit.md)
- [p10-gap-registry.md](p10-gap-registry.md)
- [platform-production-grade.mdoc](platform-production-grade.mdoc)
