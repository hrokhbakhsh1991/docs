import type { MigrationInterface, QueryRunner } from "typeorm";

export class TourDestinationId1777591600000 implements MigrationInterface {
  name = "TourDestinationId1777591600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tours" ADD COLUMN IF NOT EXISTS "destination_id" uuid NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_tours_workspace_destinations_destination_id'
        ) THEN
          ALTER TABLE "tours"
            ADD CONSTRAINT "fk_tours_workspace_destinations_destination_id"
            FOREIGN KEY ("destination_id") REFERENCES "workspace_destinations"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_tours_destination_id" ON "tours" ("destination_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_tours_destination_id"`);
    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "fk_tours_workspace_destinations_destination_id"`,
    );
    await queryRunner.query(`ALTER TABLE "tours" DROP COLUMN IF EXISTS "destination_id"`);
  }
}
