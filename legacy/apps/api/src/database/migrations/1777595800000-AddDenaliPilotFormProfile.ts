import type { MigrationInterface, QueryRunner } from "typeorm";

const VALUES =
  "('general','mountain_outdoor','nature_trip','urban_event','cinema_event','cultural_tour','denali_pilot')";

/**
 * Extends DB CHECK constraints for {@link TourFormProfile} with `denali_pilot`
 * (Denali 6-tab wizard — see map.md / denali-tenant.fixture.ts).
 */
export class AddDenaliPilotFormProfile1777595800000 implements MigrationInterface {
  name = "AddDenaliPilotFormProfile1777595800000";

  private async replaceCheck(
    queryRunner: QueryRunner,
    table: string,
    constraint: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint}"`,
    );
    await queryRunner.query(`
      ALTER TABLE "${table}"
      ADD CONSTRAINT "${constraint}"
      CHECK ("form_profile" IN ${VALUES})
    `);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replaceCheck(
      queryRunner,
      "workspace_tour_themes",
      "CHK_workspace_tour_themes_form_profile",
    );
    await this.replaceCheck(
      queryRunner,
      "workspace_tour_creation_presets",
      "CHK_workspace_tour_creation_presets_form_profile",
    );

    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "CHK_tours_form_profile_snapshot"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD CONSTRAINT "CHK_tours_form_profile_snapshot"
      CHECK ("form_profile_snapshot" IS NULL OR "form_profile_snapshot" IN ${VALUES})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const LEGACY =
      "('general','mountain_outdoor','nature_trip','urban_event','cinema_event','cultural_tour')";

    for (const [table, constraint] of [
      ["workspace_tour_themes", "CHK_workspace_tour_themes_form_profile"],
      ["workspace_tour_creation_presets", "CHK_workspace_tour_creation_presets_form_profile"],
    ] as const) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint}"`,
      );
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD CONSTRAINT "${constraint}"
        CHECK ("form_profile" IN ${LEGACY})
      `);
    }

    await queryRunner.query(
      `ALTER TABLE "tours" DROP CONSTRAINT IF EXISTS "CHK_tours_form_profile_snapshot"`,
    );
    await queryRunner.query(`
      ALTER TABLE "tours"
      ADD CONSTRAINT "CHK_tours_form_profile_snapshot"
      CHECK ("form_profile_snapshot" IS NULL OR "form_profile_snapshot" IN ${LEGACY})
    `);
  }
}
