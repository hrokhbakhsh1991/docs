import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTourAcceptanceTypeTransportFields1777586000000 implements MigrationInterface {
  name = "AddTourAcceptanceTypeTransportFields1777586000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."tour_type_enum" AS ENUM('camp', 'mountain', 'city', 'desert', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."primary_transport_mode_enum" AS ENUM('bus', 'train', 'plane', 'private_car', 'mixed', 'none')
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN "auto_accept_registrations" boolean
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN "tour_type" "public"."tour_type_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD COLUMN "primary_transport_mode" "public"."primary_transport_mode_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tours"
      DROP COLUMN "primary_transport_mode"
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      DROP COLUMN "tour_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "tours"
      DROP COLUMN "auto_accept_registrations"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."primary_transport_mode_enum"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."tour_type_enum"
    `);
  }
}
