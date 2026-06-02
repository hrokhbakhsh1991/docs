import { MigrationInterface, QueryRunner } from "typeorm";

export class UserRoleAudit1777572000000 implements MigrationInterface {
  name = "UserRoleAudit1777572000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_role_audit" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "actor_user_id" uuid NOT NULL,
        "target_user_id" uuid NOT NULL,
        "old_role" character varying(64) NOT NULL,
        "new_role" character varying(64) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_user_role_audit_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_user_role_audit_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_user_role_audit_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_user_role_audit_target_user_id" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_role_audit_tenant_id" ON "user_role_audit" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_role_audit_actor_user_id" ON "user_role_audit" ("actor_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_role_audit_target_user_id" ON "user_role_audit" ("target_user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_user_role_audit_created_at" ON "user_role_audit" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_role_audit"`);
  }
}
