import { randomUUID } from "node:crypto";

/**
 * Ensures subdomain "denali" has exactly one active owner who can OTP-login with phone "+989121236598" (OTP 1234 in non-prod API).
 *
 * Usage (from apps/api):
 *   node --env-file=.env --import tsx src/scripts/ensure-denali-otp-owner.ts
 */

import * as argon2 from "argon2";
import { DataSource, IsNull } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { Role } from "../modules/auth/roles.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { MembershipStatus } from "../modules/identity/membership-status.enum";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";

const DENALI_SUBDOMAIN = "denali";
const TARGET_PHONE = "+989121236598";
const MASKED_PHONE = "***6598";

async function main(): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity]
  });
  await dataSource.initialize();

  try {
    const tenantRepo = dataSource.getRepository(TenantEntity);
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(UserTenantEntity);

    const tenant = await tenantRepo.findOne({
      where: { subdomain: DENALI_SUBDOMAIN, deletedAt: IsNull() }
    });
    if (!tenant) {
      throw new Error(`Tenant subdomain "${DENALI_SUBDOMAIN}" not found (active row).`);
    }

    let previousOwnerUserId = "";
    const priorOwnerMb = await membershipRepo.findOne({
      where: { tenantId: tenant.id, role: Role.OWNER, deletedAt: IsNull() }
    });
    if (priorOwnerMb) {
      previousOwnerUserId = priorOwnerMb.userId;
    }

    let user =
      (await userRepo.findOne({ where: { phone: TARGET_PHONE, deletedAt: IsNull() } })) ?? null;

    const actions: string[] = [];

    if (!user) {
      const email = `denali-otp-owner-${randomUUID().slice(0, 8)}@fixture.local`;
      const hashedPassword = await argon2.hash(`fixture-${DENALI_SUBDOMAIN}`);
      user = await userRepo.save(
        userRepo.create({
          email,
          phone: TARGET_PHONE,
          hashedPassword,
          fullName: "Denali OTP owner",
          isEmailVerified: false,
          isPhoneVerified: true,
          telegramUserId: null
        })
      );
      actions.push("created user");
    } else {
      await userRepo.update({ id: user.id }, { phone: TARGET_PHONE, isPhoneVerified: true });
      user = await userRepo.findOneOrFail({ where: { id: user.id, deletedAt: IsNull() } });
      actions.push("user exists — phone normalized");
    }

    await dataSource.transaction(async (manager) => {
      const mr = manager.getRepository(UserTenantEntity);

      const currentOwner = await mr.findOne({
        where: { tenantId: tenant.id, role: Role.OWNER, deletedAt: IsNull() }
      });
      if (currentOwner && currentOwner.userId !== user!.id) {
        currentOwner.role = Role.MEMBER;
        await mr.save(currentOwner);
        actions.push("demoted previous owner membership to member");
      }

      let targetMb = await mr.findOne({
        where: {
          tenantId: tenant!.id,
          userId: user!.id,
          deletedAt: IsNull()
        }
      });
      if (targetMb) {
        targetMb.role = Role.OWNER;
        targetMb.status = MembershipStatus.ACTIVE;
        targetMb.joinedAt = targetMb.joinedAt ?? new Date();
        targetMb.suspendedAt = null;
        await mr.save(targetMb);
        actions.push("promoted existing membership to owner + active");
      } else {
        await mr.save(
          mr.create({
            tenantId: tenant.id,
            userId: user!.id,
            role: Role.OWNER,
            status: MembershipStatus.ACTIVE,
            invitedAt: null,
            joinedAt: new Date(),
            suspendedAt: null,
            sessionVersion: 1
          })
        );
        actions.push("inserted active owner membership");
      }

      const activeMembership = await mr.findOne({
        where: {
          tenantId: tenant.id,
          userId: user!.id,
          deletedAt: IsNull()
        }
      });
      console.log(
        JSON.stringify(
          {
            tag: "ensure_denali_otp_owner_membership_active",
            workspace_id: tenant.id,
            user_id: user!.id,
            membership_status: activeMembership?.status ?? null,
            role: activeMembership?.role ?? null,
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
          previousOwnerUserId: previousOwnerUserId || null,
          newOwnerUserId: user.id,
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

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
