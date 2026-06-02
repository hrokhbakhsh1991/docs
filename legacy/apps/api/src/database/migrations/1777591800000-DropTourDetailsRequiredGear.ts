import type { MigrationInterface, QueryRunner } from "typeorm";

export class DropTourDetailsRequiredGear1777591800000 implements MigrationInterface {
  name = "DropTourDetailsRequiredGear1777591800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_details" DROP COLUMN IF EXISTS "required_gear"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tour_details" ADD COLUMN IF NOT EXISTS "required_gear" jsonb NULL`);
  }
}
