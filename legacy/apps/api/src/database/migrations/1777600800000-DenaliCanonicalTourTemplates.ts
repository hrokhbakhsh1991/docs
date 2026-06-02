import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Unify workspace tour templates/presets with Denali canonical JSONB storage.
 * Wipes legacy preset defaults and wizard template overlays incompatible with the rule engine.
 */
export class DenaliCanonicalTourTemplates1777600800000 implements MigrationInterface {
  name = "DenaliCanonicalTourTemplates1777600800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM workspace_tour_creation_presets
    `);

    await queryRunner.query(`
      ALTER TABLE workspace_tour_creation_presets
      ADD COLUMN IF NOT EXISTS canonical_data jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE workspace_tour_creation_presets
      SET defaults = '{}'::jsonb
      WHERE defaults IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE workspace_tour_wizard_templates
      SET
        field_rules_overlay = '{}'::jsonb,
        step_overrides = '{"skip":[],"insert":[]}'::jsonb,
        base_profile = 'denali'
    `);

    await queryRunner.query(`
      ALTER TABLE workspace_tour_wizard_templates
      ADD COLUMN IF NOT EXISTS canonical_data jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE workspace_tour_wizard_templates
      DROP COLUMN IF EXISTS canonical_data
    `);

    await queryRunner.query(`
      ALTER TABLE workspace_tour_creation_presets
      DROP COLUMN IF EXISTS canonical_data
    `);
  }
}
