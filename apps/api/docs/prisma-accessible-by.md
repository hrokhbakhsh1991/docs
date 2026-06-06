# Prisma `accessibleBy` — Phase 3.2 reference (P3-ENTRY-04)

**Today:** `@apps/api` uses in-memory tour storage. Tenant scope is enforced via
`accessibleByTourWhere` in `src/casl/api-ability.ts` (MongoAbility + `tenantId` filter).

**When Prisma is introduced:**

```typescript
import { accessibleBy } from "@casl/prisma";
import { createApiAbility } from "../casl/api-ability";

const ability = createApiAbility(context);
await prisma.tour.findMany({
  where: { AND: [accessibleBy(ability).Tour /* filters */] },
});
```

**Equivalence now:** `accessibleByTourWhere(ability, "read")` → `{ tenantId }` — see
`src/casl/api-ability.spec.ts` and `src/db/scoped-tour.repository.ts`.
