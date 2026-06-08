# Phase 9.4 — Requirements traceability matrix (users directory focus)

```yaml
matrix_version: "2026-06-08-v1"
subphase: "9.4"
authority: audits/verification-matrix.md · subphases/9.4-users-rbac.md
scope: "9.4 Users directory — ownership transfer UI in separate row"
prerequisite_rows: [REQ-P9-013, REQ-P9-030]
enforcement_rows: [INV-P9-003, INV-P9-007, P9-F-005, RULE-P9-002]
decision_rows: [DEC-P9-004, DEC-P9-015]
```

---

## Master traceability table

| Requirement ID  | Design specification location                                                                                                 | API / web handler                                           | Action registry ID          | Smoke test ID | Target test file path                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------- | ------------- | ------------------------------------------------------ |
| **REQ-P9-040**  | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) §5 · [`users-api-dispatch-addendum.md`](users-api-dispatch-addendum.md)      | `listUsers` · `inviteUser` · `patchUserRole` · `removeUser` | **P9-4-A01** · **P9-4-A02** | **SMK-P9-03** | `apps/api/test/identity-users.spec.ts`                 |
| **REQ-P9-041**  | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) §6                                                                           | `(app)/users` · `users-page-client.tsx`                     | **P9-4-A03** · **P9-4-A04** | **SMK-P9-03** | `apps/web/test/users-directory.spec.ts`                |
| **REQ-P9-042**  | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) §3 · [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) DEC-P9-015 | `hydrateMembershipFromDb` · rank policy                     | **P9-4-A05**                | SMK-P9-03     | `packages/workspace-sdk/test/operator-ability.spec.ts` |
| **INV-P9-007**  | [`ADMIN-ROUTE-MATRIX.md`](ADMIN-ROUTE-MATRIX.md)                                                                              | `requireOperatorSession` on `/users`                        | **P9-4-A01**                | SMK-P9-03     | API-9.4-01                                             |
| **DEC-P9-004**  | [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md)                                                                              | `isAdminOrOwner` on mutate surfaces                         | **P9-4-A01**                | N/A           | CP-9.4-01..02                                          |
| **DEC-P9-015**  | [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)                                                                  | 3-tier role enum · legacy hydrate                           | **P9-4-A05**                | N/A           | CP-9.4-09..11                                          |
| **P9-F-005**    | [`verification-matrix.md`](../audits/verification-matrix.md)                                                                  | member invite deny                                          | **P9-4-A02**                | SMK-P9-03     | ASM-9.4-003                                            |
| **RULE-P9-002** | [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md)                                                                              | Urban owner regression                                      | **P9-4-A01**                | N/A           | CP-9.4-15                                              |

---

## Action registry cross-walk

| Action registry ID | Primary requirement IDs | Target path / test                                                       |
| ------------------ | ----------------------- | ------------------------------------------------------------------------ |
| **P9-4-A01**       | REQ-P9-040              | `apps/api/src/identity/users.list.handler.ts` · `identity-users.spec.ts` |
| **P9-4-A02**       | REQ-P9-040              | `apps/api/src/identity/invites.*.handler.ts`                             |
| **P9-4-A03**       | REQ-P9-041              | `apps/web/app/(app)/users/` · `users-directory.spec.ts`                  |
| **P9-4-A04**       | REQ-P9-041              | invite modal · CSV · pending tab                                         |
| **P9-4-A05**       | REQ-P9-042 · DEC-P9-015 | role rank policy · hydrate normalize                                     |

---

## Completion proof cross-walk

| Proof ID      | Requirement IDs                      | Spec                                                |
| ------------- | ------------------------------------ | --------------------------------------------------- |
| CP-9.4-01..15 | REQ-P9-040 · REQ-P9-041 · REQ-P9-042 | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) §7 |

---

## ERIP / UX supplements

| Artifact                                                                             | Binds to requirement IDs     |
| ------------------------------------------------------------------------------------ | ---------------------------- |
| [`erip/9.4-cop-users-rbac.md`](erip/9.4-cop-users-rbac.md)                           | REQ-P9-040..042 · DEC-P9-015 |
| [`AGENT-STATE-MAP-9.4.yaml`](AGENT-STATE-MAP-9.4.yaml)                               | ASM-9.4-001..018             |
| [`schemas/USERS-DIRECTORY-ROW.schema.json`](schemas/USERS-DIRECTORY-ROW.schema.json) | REQ-P9-040                   |

---

## Smoke cross-walk

| Smoke ID      | Requirement IDs                      | Action IDs   | Spec paths                                                                 |
| ------------- | ------------------------------------ | ------------ | -------------------------------------------------------------------------- |
| **SMK-P9-03** | REQ-P9-040 · REQ-P9-041 · REQ-P9-042 | P9-4-A01..05 | `identity-users.spec.ts` · `users-directory.spec.ts` · invite accept chain |

---

## 9.4 verification bundle

```bash
pnpm --filter @apps/api exec node --import tsx --test test/identity-users.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/users-directory.spec.ts
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/operator-ability.spec.ts
pnpm run phase-9:guard
```
