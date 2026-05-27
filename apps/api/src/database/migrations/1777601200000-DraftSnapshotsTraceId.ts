import { MigrationInterface, QueryRunner } from "typeorm";

export class DraftSnapshotsTraceId1777601200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots"
      ADD COLUMN IF NOT EXISTS "trace_id" varchar(128);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "draft_snapshots"
      DROP COLUMN IF EXISTS "trace_id";
    `);
  }
}
