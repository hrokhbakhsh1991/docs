-- P3-A A5: tenant workspace definition binding

ALTER TABLE "tenants"
    ADD COLUMN "workspace_definition_id" TEXT,
    ADD COLUMN "workspace_definition_version" INTEGER;

ALTER TABLE "tenants"
    ADD CONSTRAINT "tenants_workspace_definition_id_fkey"
    FOREIGN KEY ("workspace_definition_id") REFERENCES "workspace_definitions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "idx_tenants_workspace_definition_id"
    ON "tenants"("workspace_definition_id");
