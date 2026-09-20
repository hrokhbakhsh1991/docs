ALTER TABLE "user_tenants"
ADD COLUMN "membership_code" TEXT;

WITH numbered AS (
  SELECT
    ut."user_id",
    ut."tenant_id",
    CONCAT(
      UPPER(TRIM(BOTH '-' FROM REGEXP_REPLACE(t."subdomain", '[^a-zA-Z0-9]+', '-', 'g'))),
      '-',
      LPAD((ROW_NUMBER() OVER (
        PARTITION BY ut."tenant_id"
        ORDER BY ut."created_at" ASC, ut."user_id" ASC
      ))::text, 6, '0')
    ) AS membership_code
  FROM "user_tenants" ut
  INNER JOIN "tenants" t ON t."id" = ut."tenant_id"
)
UPDATE "user_tenants" ut
SET "membership_code" = numbered.membership_code
FROM numbered
WHERE ut."user_id" = numbered."user_id"
  AND ut."tenant_id" = numbered."tenant_id";

CREATE UNIQUE INDEX "uq_user_tenants_tenant_membership_code"
ON "user_tenants"("tenant_id", "membership_code");
