import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Purges legacy tour creation presets and resets workspace wizard templates to canonical-only shells.
 * Run `cleanupLegacyTemplates.ts` for the same behavior with a detailed report.
 */
export class CleanupLegacyTourTemplates1777600900000 implements MigrationInterface {
  name = "CleanupLegacyTourTemplates1777600900000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM workspace_tour_creation_presets`);

    await queryRunner.query(`
      UPDATE workspace_tour_wizard_templates
      SET
        field_rules_overlay = '{}'::jsonb,
        step_overrides = '{"skip":[],"insert":[]}'::jsonb,
        canonical_data = '{}'::jsonb,
        base_profile = 'denali'
    `);
  }

  public async down(): Promise<void> {
    /* Destructive data wipe — no restore. */
  }
}
