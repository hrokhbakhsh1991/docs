-- P3-A A1: workspace_definitions + workspace_definition_versions

CREATE TABLE "workspace_definitions" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workspace_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_definition_versions" (
    "id" UUID NOT NULL,
    "definition_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "plugin_api_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_by_platform_ops_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_definition_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_workspace_definition_versions_def_version"
    ON "workspace_definition_versions"("definition_id", "version");

CREATE INDEX "idx_workspace_definition_versions_definition_id"
    ON "workspace_definition_versions"("definition_id");

ALTER TABLE "workspace_definition_versions"
    ADD CONSTRAINT "workspace_definition_versions_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "workspace_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
