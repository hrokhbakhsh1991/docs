import type { MigrationInterface, QueryRunner } from "typeorm";

/** Arabic-Indic (U+0660–U+0669) + Persian (U+06F0–U+06F9) → ASCII 0–9 before stripping non-phone chars. */
const FROM_DIGITS =
  "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669" +
  "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
const TO_ASCII = "01234567890123456789";

export class PhoneNormalizedUnicodeDigits1777593600000 implements MigrationInterface {
  name = "PhoneNormalizedUnicodeDigits1777593600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION phone_normalized(p_phone text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      RETURNS NULL ON NULL INPUT
      AS $$
        SELECT NULLIF(
          regexp_replace(
            translate(trim(p_phone), '${FROM_DIGITS}', '${TO_ASCII}'),
            '[^0-9+]', '', 'g'
          ),
          ''
        );
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION phone_normalized(p_phone text)
      RETURNS text
      LANGUAGE sql
      IMMUTABLE
      RETURNS NULL ON NULL INPUT
      AS $$
        SELECT NULLIF(regexp_replace(trim(p_phone), '[^0-9+]', '', 'g'), '');
      $$;
    `);
  }
}
