# P9 — Gap registry (strict audit v1.2 — app-fit aligned)

```yaml
registry_id: P9-GAP-REGISTRY
pack: P9
version: "1.2"
status: PLANNED
audit: p9-code-consolidation-audit.md
app_fit: p9-app-fit.md
boundaries: p9-package-boundary.yaml
prerequisite: P8 exit
```

> Severity: P0 = blocker for enterprise code unity. Full rubric: [p9-code-consolidation-audit.md](p9-code-consolidation-audit.md).

---

## Guest bootstrap (G-BOOT)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-BOOT-01 | P0 | M+P duplicate `resolve-host-tenant.ts` — **web keeps operator copy** | P9-0 | marketing · portal → package; web operator-only |
| G-BOOT-02 | P0 | `PHASE_43_HOST_TENANT_IDS` in M+P — drift risk | P9-0 | guest-surface-host single source |
| G-BOOT-03 | P0 | `resolvePluginIdForTenant` + `hostname.includes("denali")` | P9-2 | M+P bootstrap identical |
| G-BOOT-04 | P1 | `auth-env` M+P semantics differ | P9-0 | unify **M+P only** — web operator separate |
| G-BOOT-05 | P1 | `fetch-public-tenant-context` duplicate M+P (+ web legacy) | P9-0 | M+P → package; web removed with P9-1 bootstrap |
| G-BOOT-06 | P1 | `resolve-public-branding-host.ts` byte-identical M+P | P9-0 | diff empty |
| G-BOOT-07 | P2 | web `resolve-multi-level-host` wrapper vs kernel | P9-0 | web only |
| G-BOOT-08 | P2 | web `resolve-public-catalog-bootstrap.server.ts` legacy | P9-1 | 90 lines |

---

## Surface boundary (G-SURF)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-SURF-01 | P0 | web 5× `app/api/public-auth/*` routes active | P9-1 | middleware whitelist |
| G-SURF-02 | P0 | orphan `public-catalog-registration-flow.tsx` web (563 lines) | P9-1 | zero imports |
| G-SURF-03 | P1 | web layout `isPublicCatalogPath` guest bootstrap | P9-1 | `app/layout.tsx` |
| G-SURF-04 | P1 | middleware public-auth whitelist — **keep** `/catalog` redirect paths | P9-1 | trim public-auth only |
| G-SURF-05 | P1 | web catalog bootstrap tests + server module | P9-1 | resolve-public-catalog-bootstrap |
| G-SURF-06 | P2 | docs cite web OTP flow | P9-3 | public-catalog.md |
| G-SURF-07 | P2 | e2e registration on `@apps/web` | P9-3 | package scripts |

---

## Auth / BFF dedup (G-AUTH)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-AUTH-01 | P0 | web duplicate public-auth BFF (5 routes) — **delete web; portal sole owner** | P9-1 | not cross-app factory |
| G-AUTH-02 | P0 | `decode-jwt-payload.ts` duplicate | P9-0 | web · portal |
| G-AUTH-03 | P0 | `validate-session-token.ts` duplicate | P9-0 | web · portal |
| G-AUTH-04 | P1 | `read-public-catalog-session.server.ts` duplicate | P9-1 | **portal-only** after web cut |
| G-AUTH-05 | P1 | `build-catalog-registration-headers` duplicate | P9-1 | **portal-only** module |
| G-AUTH-06 | P1 | `public-auth-bff-error.ts` duplicate | P9-1 | portal-only after web delete |
| G-AUTH-07 | P2 | web `resolve-identity-bff-tenant` → catalog bootstrap | P9-1 | web only |
| G-AUTH-08 | P2 | JWT decode no sig verify — duplicate doubles fix cost | P9-0 | both apps |

---

## Package & boundaries (G-PKG)

| ID | Sev | Gap | EPIC | Evidence |
| -- | --- | --- | ---- | -------- |
| G-PKG-01 | P0 | No `packages/guest-surface-host` | P9-0 | — |
| G-PKG-02 | P1 | No guard: web forbidden public-auth post-P9 | P9-3 | guard scripts |
| G-PKG-03 | P1 | Copy-paste not workspace packages | P9-0 | 3 apps |
| G-PKG-04 | — | ~~`tenant_domains.surface`~~ → **P10** G-ING-04b | — | not P9 |
| G-PKG-05 | P2 | `build:operator-vps` omits M+P | P9-0 | package.json |
| G-PKG-06 | P3 | No package owner tags | P9-3 | governance |

---

## Score summary (strict)

| Axis | Current | P9 target (fit) |
| ---- | ------: | -------------: |
| Guest bootstrap (M+P) | 3.0 | **≥ 9** |
| Surface boundary | 3.5 | **≥ 9** |
| Auth/BFF dedup | 2.0 | **≥ 8.5** |
| Package architecture | 4.0 | **≥ 8.5** |
| Boundary enforcement | 3.5 | **≥ 8.5** |
| **Composite** | **3.2** | **≥ 8.7** |

---

## Wave map

| Wave | IDs |
| ---- | --- |
| **A (P0)** | G-BOOT-01..03 · G-SURF-01/02 · G-AUTH-01..03 · G-PKG-01 |
| **B (P1)** | G-BOOT-04..07 · G-SURF-03..05 · G-AUTH-04..06 · G-PKG-02/03 |
| **C (P2+)** | G-SURF-06/07 · G-PKG-05/06 · p9:gate |

---

## References

- [p9-app-fit.md](p9-app-fit.md)
- [p9-code-consolidation-audit.md](p9-code-consolidation-audit.md)
- [p9-action-plan.yaml](p9-action-plan.yaml)
- [p9-package-boundary.yaml](p9-package-boundary.yaml)
