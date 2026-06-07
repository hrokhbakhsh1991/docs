# Urban product scope — Phase 8 delta over Phase 7 minimal

```yaml
scope_version: "2026-06-07-v1"
baseline: docs/phase-7/appendices/URBAN-MINIMAL-SCOPE.md
decision: DEC-P8-002
plugin_package: "@app-tour/workspace-urban"
prisma_schema: apps/api/prisma/schema.prisma
migration_target: infra/sql/004_urban_product_delta.sql
```

## Intent

Phase 7 delivered a **minimal urban shell** (city tour wizard, slim registry, golden fixtures). Phase 8 extends the same plugin with **product parity** semantics: public catalog, registration intake, owner settings — **without** Denali finance, MinIO, or itinerary fields.

**Binding:** All canonical tour fields remain in `Tour.canonical` JSON (INV-P8-005). Denormalized columns exist **only** for indexed hot paths (TQ-P8-005 · TQ-P8-010).

---

## Phase 7 baseline (unchanged — do not remove)

See [`../../phase-7/appendices/URBAN-MINIMAL-SCOPE.md`](../../phase-7/appendices/URBAN-MINIMAL-SCOPE.md).

| Path               | Type                 | Required |
| ------------------ | -------------------- | -------- |
| `tour.title`       | string               | yes      |
| `tour.city`        | string               | yes      |
| `tour.venueName`   | string               | yes      |
| `tour.startDate`   | ISO date             | yes      |
| `tour.endDate`     | ISO date             | yes      |
| `tour.capacity`    | integer              | yes      |
| `tour.description` | string               | no       |
| `tour.status`      | `draft \| published` | yes      |

Forbidden prefixes unchanged: `tripDetails.itinerary.*`, `tripDetails.participation.*`, `transportModes`.

---

## Plugin field registry delta (Phase 8 additions)

New canonical paths validated by `getUrbanWorkspacePlugin().validationHooks` in `packages/workspaces/urban/src/urban.plugin.ts`.

### Catalog display (read paths — public + admin)

| Path                  | Type         | Required | Validation                                           | Subphase |
| --------------------- | ------------ | -------- | ---------------------------------------------------- | -------- |
| `tour.catalogSummary` | string       | no       | maxLength 500                                        | 8.2      |
| `tour.coverImageUrl`  | string (URL) | no       | `https?://` only — **no MinIO SDK** (INV-P8-001)     | 8.2      |
| `tour.publishStatus`  | enum         | yes      | `draft \| published \| archived` — mirrors DB column | 8.2      |
| `tour.publishedAt`    | ISO datetime | no       | required when `publishStatus=published`              | 8.2      |

### Registration intake (write path — public POST)

| Path                            | Type    | Required | Validation                                         | Subphase |
| ------------------------------- | ------- | -------- | -------------------------------------------------- | -------- |
| `registration.contact.email`    | string  | yes      | RFC5322 subset · max 320                           | 8.2      |
| `registration.contact.fullName` | string  | yes      | minLength 1 · max 200                              | 8.2      |
| `registration.contact.phone`    | string  | no       | E.164 or local pattern · max 32                    | 8.2      |
| `registration.partySize`        | integer | no       | min 1 · max `tour.capacity`                        | 8.2      |
| `registration.notes`            | string  | no       | maxLength 2000                                     | 8.2      |
| `registration.source`           | enum    | no       | `catalog \| direct` — server-set default `catalog` | 8.2      |

### Owner settings (theme JSON — not canonical tour document)

Stored in `tenants.theme.urban` (existing `Tenant.theme` Json column). Validated by Zod at `PATCH /urban/settings`.

| Path                                     | Type    | Required | Validation                              | Subphase  |
| ---------------------------------------- | ------- | -------- | --------------------------------------- | --------- |
| `urban.catalog.publicEnabled`            | boolean | yes      | default `true`                          | 8.1 / 8.2 |
| `urban.catalog.slug`                     | string  | yes      | `^[a-z0-9-]{1,64}$` · default `catalog` | 8.2       |
| `urban.registration.policy`              | enum    | yes      | `open \| waitlist \| closed`            | 8.2       |
| `urban.registration.requirePhone`        | boolean | no       | default `false`                         | 8.2       |
| `urban.registration.confirmationMessage` | string  | no       | maxLength 1000                          | 8.2       |

### Composites delta

| composite_id               | Purpose                                  | Subphase |
| -------------------------- | ---------------------------------------- | -------- |
| `urban.cityTourSummary`    | _(Phase 7 — retained)_                   | 7.1      |
| `urban.publishReadiness`   | _(Phase 7 — retained)_                   | 7.1      |
| `urban.publicCatalogCard`  | Catalog grid card — city, dates, summary | 8.2      |
| `urban.registrationForm`   | Public registration field layout         | 8.2      |
| `urban.ownerSettingsPanel` | Owner settings shell sections            | 8.2      |

### Golden fixtures delta (8.2)

| File                                                                                   | Purpose                              |
| -------------------------------------------------------------------------------------- | ------------------------------------ |
| `packages/workspaces/urban/test/fixtures/golden/urban-tour-minimal.json`               | Phase 7 — retained                   |
| `packages/workspaces/urban/test/fixtures/golden/urban-tour-invalid-itinerary.json`     | Phase 7 — must still **fail**        |
| `packages/workspaces/urban/test/fixtures/golden/urban-tour-publish-ready.json`         | **New** — passes publishReadiness    |
| `packages/workspaces/urban/test/fixtures/golden/urban-registration-minimal.json`       | **New** — valid registration payload |
| `packages/workspaces/urban/test/fixtures/golden/urban-registration-invalid-email.json` | **New** — must **fail** validation   |

---

## Prisma schema delta

**Authority file:** `apps/api/prisma/schema.prisma`  
**Migration file:** `infra/sql/004_urban_product_delta.sql` (author in 8.2 — **not yet applied**)

### Model: `Tour` (extend existing)

Phase 7 trunk today:

```prisma
model Tour {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @map("tenant_id") @db.Uuid
  canonical      Json     @map("canonical_data")
  title          String?
  schemaVersion  Int      @default(1) @map("schema_version")
  rowVersion     Int      @default(1) @map("row_version")
  createdAt      DateTime @default(now()) @map("created_at")
  tenant         Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, id])
  @@index([tenantId])
  @@index([tenantId, title])
  @@map("tours")
}
```

**Phase 8 columns (denormalized projection from canonical — written on persist by urban route handlers):**

| Column           | Prisma field    | PostgreSQL type | Nullable | Source                         |
| ---------------- | --------------- | --------------- | -------- | ------------------------------ |
| `publish_status` | `publishStatus` | `TEXT`          | NO       | `canonical.tour.publishStatus` |
| `published_at`   | `publishedAt`   | `TIMESTAMPTZ`   | YES      | set on publish transition      |
| `city`           | `city`          | `TEXT`          | YES      | `canonical.tour.city`          |
| `venue_name`     | `venueName`     | `TEXT`          | YES      | `canonical.tour.venueName`     |
| `start_date`     | `startDate`     | `DATE`          | YES      | `canonical.tour.startDate`     |
| `end_date`       | `endDate`       | `DATE`          | YES      | `canonical.tour.endDate`       |

**Target Prisma fragment:**

```prisma
model Tour {
  id            String    @id @default(uuid()) @db.Uuid
  tenantId      String    @map("tenant_id") @db.Uuid
  canonical     Json      @map("canonical_data")
  title         String?
  publishStatus String    @default("draft") @map("publish_status")
  publishedAt   DateTime? @map("published_at") @db.Timestamptz
  city          String?
  venueName     String?   @map("venue_name")
  startDate     DateTime? @map("start_date") @db.Date
  endDate       DateTime? @map("end_date") @db.Date
  schemaVersion Int       @default(1) @map("schema_version")
  rowVersion    Int       @default(1) @map("row_version")
  createdAt     DateTime  @default(now()) @map("created_at")
  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  registrations UrbanRegistration[]

  @@unique([tenantId, id])
  @@index([tenantId], map: "idx_tours_tenant_id")
  @@index([tenantId, title], map: "idx_tours_tenant_title")
  @@index([tenantId, publishStatus, publishedAt(sort: Desc)], map: "idx_tours_tenant_publish_catalog")
  @@index([tenantId, city, publishStatus], map: "idx_tours_tenant_city_publish")
  @@map("tours")
}
```

### Model: `UrbanRegistration` (new)

| Column       | Prisma field | PostgreSQL type | Nullable | Notes                                |
| ------------ | ------------ | --------------- | -------- | ------------------------------------ |
| `id`         | `id`         | `UUID`          | NO       | PK                                   |
| `tenant_id`  | `tenantId`   | `UUID`          | NO       | FK → `tenants.id`                    |
| `tour_id`    | `tourId`     | `UUID`          | NO       | FK → `tours.id`                      |
| `email`      | `email`      | `TEXT`          | NO       | normalized lowercase                 |
| `full_name`  | `fullName`   | `TEXT`          | NO       |                                      |
| `phone`      | `phone`      | `TEXT`          | YES      |                                      |
| `party_size` | `partySize`  | `INT`           | YES      |                                      |
| `status`     | `status`     | `TEXT`          | NO       | `waitlist \| confirmed \| cancelled` |
| `payload`    | `payload`    | `JSONB`         | NO       | plugin-validated extras              |
| `created_at` | `createdAt`  | `TIMESTAMPTZ`   | NO       | default `now()`                      |

**Target Prisma model:**

```prisma
model UrbanRegistration {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  tourId    String   @map("tour_id") @db.Uuid
  email     String
  fullName  String   @map("full_name")
  phone     String?
  partySize Int?     @map("party_size")
  status    String   @default("waitlist")
  payload   Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  tour      Tour     @relation(fields: [tenantId, tourId], references: [tenantId, id])

  @@unique([tenantId, tourId, email], map: "uq_urban_reg_tenant_tour_email")
  @@index([tenantId, tourId, createdAt(sort: Desc)], map: "idx_urban_reg_tenant_tour_created")
  @@index([tenantId, email], map: "idx_urban_reg_tenant_email")
  @@index([tenantId, status, createdAt(sort: Desc)], map: "idx_urban_reg_tenant_status_created")
  @@map("urban_registrations")
}
```

### Model: `Tenant` (relation only)

Add relation fields:

```prisma
model Tenant {
  // ... existing fields ...
  urbanRegistrations UrbanRegistration[]
}
```

**No new tenant columns** — urban settings live in `theme` JSON.

---

## DDL target (`infra/sql/004_urban_product_delta.sql`)

```sql
-- Phase 8.2 — Urban product parity (catalog + registration)
-- Apply via prisma migrate deploy after schema.prisma sync

ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

ALTER TABLE tours
  ADD CONSTRAINT chk_tours_publish_status
  CHECK (publish_status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_tours_tenant_publish_catalog
  ON tours (tenant_id, publish_status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tours_tenant_city_publish
  ON tours (tenant_id, city, publish_status);

CREATE TABLE IF NOT EXISTS urban_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  party_size INT,
  status TEXT NOT NULL DEFAULT 'waitlist',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_urban_reg_status CHECK (status IN ('waitlist', 'confirmed', 'cancelled')),
  CONSTRAINT fk_urban_reg_tour FOREIGN KEY (tenant_id, tour_id)
    REFERENCES tours (tenant_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_urban_reg_tenant_tour_email
  ON urban_registrations (tenant_id, tour_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_urban_reg_tenant_tour_created
  ON urban_registrations (tenant_id, tour_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_urban_reg_tenant_email
  ON urban_registrations (tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_urban_reg_tenant_status_created
  ON urban_registrations (tenant_id, status, created_at DESC);
```

---

## Index rationale (TQ-P8-005 · TQ-P8-010)

| Index name                            | Columns                                          | Hot query                          | Big-O                        |
| ------------------------------------- | ------------------------------------------------ | ---------------------------------- | ---------------------------- |
| `idx_tours_tenant_publish_catalog`    | `(tenant_id, publish_status, published_at DESC)` | `GET /urban/catalog` paginated     | **O(log N)** seek per tenant |
| `idx_tours_tenant_city_publish`       | `(tenant_id, city, publish_status)`              | `GET /urban/catalog?city=`         | **O(log N)**                 |
| `idx_urban_reg_tenant_tour_created`   | `(tenant_id, tour_id, created_at DESC)`          | Owner admin registration list      | **O(log N)**                 |
| `uq_urban_reg_tenant_tour_email`      | `(tenant_id, tour_id, lower(email))`             | `POST /urban/registrations` dedupe | **O(log N)** uniqueness      |
| `idx_urban_reg_tenant_status_created` | `(tenant_id, status, created_at DESC)`           | Waitlist queue drain               | **O(log N)**                 |

**EXPLAIN proof (8.2 COP):** `urban-catalog-registration.spec.ts` must attach or assert plan uses `idx_tours_tenant_publish_catalog` for catalog list.

---

## Outbox + events (TQ-P8-006)

| Event                        | Trigger                             | Outbox row                                              |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `urban.registration.created` | `POST /urban/registrations` persist | Reuse `OutboxEvent` — `aggregateType: TourRegistration` |
| `urban.catalog.published`    | `POST /urban/catalog/{id}/publish`  | `eventType: urban.catalog.published`                    |

**Forbidden:** new `urban_outbox_*` tables · `setImmediate` publish in route handlers.

---

## Explicit exclusions (unchanged from Phase 7)

- Finance / payments / receipts
- MinIO / object storage SDK
- Itinerary / transport / participation field groups
- `packages/platform-core` schema or engine changes (INV-P8-001)

---

## Verification

| Check                    | Command                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Registry delta vs plugin | `pnpm --filter @app-tour/workspace-urban test urban-registry.spec.ts`                     |
| Golden publish fixture   | `pnpm --filter @app-tour/workspace-urban test` — includes `urban-tour-publish-ready.json` |
| Registration validation  | `pnpm --filter @apps/api test urban-catalog-registration.spec.ts`                         |
| Scope doc present        | `test -f docs/phase-8/appendices/URBAN-PRODUCT-SCOPE.md`                                  |

**REQ:** REQ-P8-005 · REQ-P8-013 · REQ-P8-020 · REQ-P8-021 — see [`../audits/verification-matrix.md`](../audits/verification-matrix.md).
