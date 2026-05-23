import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 16.12: strip factory placeholder JSON from workspace tour-creation presets
 * and remove legacy seed preset name patterns.
 */
export class SanitizeWorkspaceTourPresetFactoryDefaults1777600400000
  implements MigrationInterface
{
  name = "SanitizeWorkspaceTourPresetFactoryDefaults1777600400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM workspace_tour_creation_presets
      WHERE name LIKE 'دنالی-%'
    `);

    await queryRunner.query(`
      UPDATE workspace_tour_creation_presets
      SET defaults = (
        SELECT jsonb_strip_nulls(
          jsonb_build_object(
            'basicInfo',
              CASE
                WHEN defaults ? 'basicInfo' AND defaults->'basicInfo' ? 'tourType'
                THEN jsonb_build_object('tourType', defaults->'basicInfo'->'tourType')
                ELSE NULL
              END,
            'programNature',
              CASE
                WHEN defaults ? 'programNature' AND defaults->'programNature' ? 'mainTourThemeId'
                THEN jsonb_build_object('mainTourThemeId', defaults->'programNature'->'mainTourThemeId')
                ELSE NULL
              END,
            'transport', '{}'::jsonb,
            'pricingPayment', '{}'::jsonb,
            'participantRequirements', '{}'::jsonb,
            'policies', '{}'::jsonb,
            'photosData', COALESCE(defaults->'photosData', '{"photos":[]}'::jsonb)
          )
        )
      )
      WHERE defaults IS NOT NULL
        AND (
          defaults->'basicInfo'->>'title' = 'abcdefghijabcdefghij'
          OR defaults::text LIKE '%نمونه%'
          OR defaults::text LIKE '%abcdefghij%'
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible data sanitation — no factory defaults restored.
  }
}
