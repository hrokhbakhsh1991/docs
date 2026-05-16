import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { DataSource, IsNull } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { UserRole } from "../common/auth/user-role.enum";
import { MembershipStatus } from "../modules/identity/membership-status.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";

const DENALI_SUBDOMAIN = "denali";
const TARGET_PHONE = "+989121234567";
const MASKED_PHONE = "***4567";

async function main(): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity]
  });
  await dataSource.initialize();

  try {
    const tenantRepo = dataSource.getRepository(TenantEntity);
    const userRepo = dataSource.getRepository(UserEntity);
    const tenant = await tenantRepo.findOne({
      where: { subdomain: DENALI_SUBDOMAIN, deletedAt: IsNull() }
    });
    if (!tenant) {
      throw new Error(`Tenant subdomain "${DENALI_SUBDOMAIN}" not found (active row).`);
    }

    let user = await userRepo.findOne({
      where: { phone: TARGET_PHONE, deletedAt: IsNull() }
    });

    const actions: string[] = [];

    if (!user) {
      const email = `denali-otp-invited-${randomUUID().slice(0, 8)}@fixture.local`;
      const hashedPassword = await argon2.hash(`fixture-invited-${DENALI_SUBDOMAIN}`);
      user = await userRepo.save(
        userRepo.create({
          email,
          phone: TARGET_PHONE,
          hashedPassword,
          fullName: "Denali OTP invited",
          isEmailVerified: false,
          isPhoneVerified: true,
          telegramUserId: null
        })
      );
      actions.push("created invited user");
    } else {
      await userRepo.update({ id: user.id }, { phone: TARGET_PHONE, isPhoneVerified: true });
      user = await userRepo.findOneOrFail({ where: { id: user.id, deletedAt: IsNull() } });
      actions.push("invited user exists — phone normalized");
    }

    await dataSource.transaction(async (manager) => {
      const mr = manager.getRepository(UserTenantEntity);
      let membership = await mr.findOne({
        where: {
          tenantId: tenant.id,
          userId: user!.id,
          deletedAt: IsNull()
        }
      });

      if (!membership) {
        membership = await mr.save(
          mr.create({
            tenantId: tenant.id,
            userId: user!.id,
            role: UserRole.Member,
            status: MembershipStatus.INVITED,
            invitedAt: new Date(),
            joinedAt: null,
            suspendedAt: null,
            sessionVersion: 1
          })
        );
        actions.push("inserted invited membership");
      } else {
        membership.role = UserRole.Member;
        membership.status = MembershipStatus.INVITED;
        membership.invitedAt = membership.invitedAt ?? new Date();
        membership.joinedAt = null;
        membership.suspendedAt = null;
        membership = await mr.save(membership);
        actions.push("updated membership to invited");
      }

      console.log(
        JSON.stringify(
          {
            tag: "ensure_denali_otp_invited_membership",
            workspace_id: tenant.id,
            user_id: user!.id,
            membership_status: membership.status,
            role: membership.role,
            phone_masked: MASKED_PHONE
          },
          null,
          2
        )
      );
    });

    console.log(
      JSON.stringify(
        {
          status: "ok",
          tenantId: tenant.id,
          tenantSubdomain: tenant.subdomain,
          userId: user.id,
          phone_masked: MASKED_PHONE,
          actions: actions.join("; ")
        },
        null,
        2
      )
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
