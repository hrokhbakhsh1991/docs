import type { MigrationInterface, QueryRunner } from "typeorm";

export class UserMembershipStatus1777584000000 implements MigrationInterface {
  name = "UserMembershipStatus1777584000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_membership_status_enum') THEN
          CREATE TYPE user_membership_status_enum AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      ADD COLUMN IF NOT EXISTS "membership_status" user_membership_status_enum
      NOT NULL
      DEFAULT 'INVITED'
    `);

    await queryRunner.query(`
      UPDATE user_tenants ut
      SET membership_status = CASE
        WHEN COALESCE(u.is_email_verified, false) THEN 'ACTIVE'::user_membership_status_enum
        ELSE 'INVITED'::user_membership_status_enum
      END
      FROM users u
      WHERE u.id = ut.user_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_tenants"
      DROP COLUMN IF EXISTS "membership_status"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS user_membership_status_enum
    `);
  }
}

