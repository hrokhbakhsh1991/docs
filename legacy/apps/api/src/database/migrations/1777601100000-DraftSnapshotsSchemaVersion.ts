import { MigrationInterface, QueryRunner } from "typeorm";

export class DraftSnapshotsSchemaVersion1777601100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots"
      ADD COLUMN IF NOT EXISTS "schema_version" int NOT NULL DEFAULT 1;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots"
      DROP COLUMN IF EXISTS "schema_version";
    `);
  }
}
