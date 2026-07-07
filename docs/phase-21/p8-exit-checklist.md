# P8 exit checklist (fit-aligned v1.2)

```yaml
pack: P8
phase: 21
status: BEHAVIORAL_COMPLETE
prerequisite: P7 BEHAVIORAL_COMPLETE
audit: p8-ingress-session-env-audit.md
app_fit: p8-app-fit.md
target_scores:
  profile_a: 9
  profile_b_session: 8
  profile_b_ingress: 8
  env: 9
```

> **Scope:** Profile A dev + Profile B VPS IP. __Host- cookies · custom apex · web public-auth → **not P8**.

---

## Score gate (fit-aligned)

| Profile | Ingress | Session | Env |
| ------- | ------: | ------: | --: |
| **A** `*.localhost` | **≥ 9** | **≥ 9** | **≥ 9** |
| **B** VPS IP HTTP | **≥ 8** | **≥ 8** (IP cap) | **≥ 9** |

---

## Wave A — P0 (required) → nanos

- [x] G-ING-01 API IP fallback wired — **P8-0-N-001**
- [x] G-ING-02 Marketing silent fallback removed — **P8-0-N-002**
- [x] G-SES-01 Distinct cookie **names** (not __Host- on HTTP) — **P8-1-N-001**
- [x] G-SES-02 IP :3000/:3003 cookies do not overwrite — **P8-1-N-001**
- [x] G-SES-03 JWT↔host fail-closed (web + portal) — **P8-1-N-002**
- [x] G-SES-06 Portal SESSION_COOKIE_SECURE parity — **P8-1-N-004**
- [x] G-ENV-01 Bootstrap 4 env files — **P8-2-N-001**

---

## Wave B — P1 → nanos

- [x] G-ING-03 M+P bootstrap error parity — **P8-0-N-005**
- [x] G-ING-04a Parser surface `club_*` kinds enforced — **P8-0-N-003**
- [x] G-ING-05a API loopback-only doc on VPS — **P8-0-N-004**
- [x] G-SES-04 Portal middleware — **P8-1-N-003**
- [x] G-SES-05 `/me` JWT tenant vs host — **P8-1-N-002**
- [x] G-ENV-02..04 verify `--all` · contract · fail-fast — **P8-2-N-001/002/004**

---

## Wave C — P8 gate → nanos

- [x] G-ENV-07 README four-process — **P8-3-N-001**
- [x] `pnpm run p8:gate` Profile A green — **P8-3-N-001** (Profile B VPS post-deploy)
- [x] CI verify-env on deploy — **P8-3-N-002**

---

## Explicitly NOT P8 exit criteria

- [ ] ~~G-SES-07 __Host- prefix~~ → P10
- [ ] ~~G-ING-04b custom domain DB surface~~ → P10
- [ ] ~~G-SES-09 remove web public-auth~~ → P9
- [ ] ~~guest-surface-host package~~ → P9

---

## Smoke (Profile A + B)

- [x] smoke-p6-host-bind on localhost dev hosts
- [x] M+P tenant-context 200 on VPS IP — Profile B (`p8:staging-remote-smoke`)
- [x] Separate operator/member cookie names on IP — Profile B (smoke-p8-profile-b)
- [x] p6:gate + p7:gate regression

---

## References

- [AGENT-START.md](AGENT-START.md)
- [appendices/P8-IMPLEMENTATION-TRUTH.md](appendices/P8-IMPLEMENTATION-TRUTH.md)
- [p8-app-fit.md](p8-app-fit.md)
