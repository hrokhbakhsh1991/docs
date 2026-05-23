import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as argon2 from "argon2";
import { DataSource, IsNull } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptDebug, emitScriptInfo } from "./script-log";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { UserRole } from "../common/auth/user-role.enum";

type SeedOutput = {
  seededAt: string;
  tenantId: string;
  /** Subdomain slug for Host `{tenantSubdomain}.{TENANT_ROOT_DOMAIN}` (e.g. demo.localhost). */
  tenantSubdomain: string;
  tenantName: string;
  user: {
    id: string;
    email: string;
    phone: string;
    password: string;
    role: string;
  };
};

async function run(): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity]
  });

  await dataSource.initialize();
  try {
    const tenantRepo = dataSource.getRepository(TenantEntity);
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(UserTenantEntity);
    // Local-dev deterministic leader account requested by product/dev workflows.
    const localTenantName = "demo-tenant";
    const localLeaderEmail = "leader@test.com";
    const localLeaderPhone = "+15551234567";
    const localLeaderPassword = "demo123";

    let localTenant = await tenantRepo.findOne({
      where: { name: localTenantName, deletedAt: IsNull() }
    });
    if (!localTenant) {
      localTenant = await tenantRepo.save(
        tenantRepo.create({
          name: localTenantName,
          description: "Local development tenant for deterministic login",
          subdomain: "demo"
        })
      );
    } else if (!localTenant.subdomain) {
      localTenant.subdomain = "demo";
      await tenantRepo.save(localTenant);
    }

    let localLeader = await userRepo.findOne({
      where: { email: localLeaderEmail, deletedAt: IsNull() }
    });
    if (!localLeader) {
      // AuthService verifies passwords with argon2; keep hash algorithm aligned so login works.
      const localHashedPassword = await argon2.hash(localLeaderPassword);
      localLeader = await userRepo.save(
        userRepo.create({
          email: localLeaderEmail,
          phone: localLeaderPhone,
          hashedPassword: localHashedPassword,
          fullName: "Local Demo Leader",
          isEmailVerified: true,
          isPhoneVerified: true,
          telegramUserId: null
        })
      );
    } else {
      await userRepo.update(
        { id: localLeader.id },
        {
          phone: localLeader.phone?.trim() || localLeaderPhone,
          isPhoneVerified: true
        }
      );
      localLeader = await userRepo.findOneOrFail({ where: { id: localLeader.id } });
    }

    const existingMembership = await membershipRepo.findOne({
      where: {
        tenantId: localTenant.id,
        userId: localLeader.id,
        deletedAt: IsNull()
      }
    });
    if (!existingMembership) {
      await membershipRepo.save(
        membershipRepo.create({
          tenantId: localTenant.id,
          userId: localLeader.id,
          role: UserRole.Owner
        })
      );
    }

    const tenantName = `Freeze QA Tenant ${new Date().toISOString()}`;
    const freezeSlug = `freeze${Date.now().toString(36)}`;
    const seededTenant = await tenantRepo.save(
      tenantRepo.create({
        name: tenantName,
        description: "Seeded tenant for backend freeze E2E validation",
        subdomain: freezeSlug
      })
    );

    const userEmail = `freeze.qa.${Date.now()}@example.com`;
    const userPhone = `+1555${Date.now().toString().slice(-7)}`;
    const userPassword = "Passw0rd!";
    const hashedPassword = await argon2.hash(userPassword);
    const seededUser = await userRepo.save(
      userRepo.create({
        email: userEmail,
        phone: userPhone,
        hashedPassword,
        fullName: "Freeze QA Leader",
        isEmailVerified: true,
        isPhoneVerified: true,
        telegramUserId: null
      })
    );

    await membershipRepo.save(
      membershipRepo.create({
        tenantId: seededTenant.id,
        userId: seededUser.id,
        role: UserRole.Owner
      })
    );

    const output: SeedOutput = {
      seededAt: new Date().toISOString(),
      tenantId: seededTenant.id,
      tenantSubdomain: freezeSlug,
      tenantName,
      user: {
        id: seededUser.id,
        email: userEmail,
        phone: userPhone,
        password: userPassword,
        role: UserRole.Owner
      }
    };

    const outputPath = join(process.cwd(), ".seed-output.json");
    await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
    emitScriptInfo(`Local leader tenant id: ${localTenant.id}`);
    emitScriptInfo(`Local leader user id: ${localLeader.id}`);
    emitScriptInfo("✅ Seeded Leader user: leader@test.com / demo123");
    emitScriptInfo(`Seed complete. Output written to ${outputPath}`);
    emitScriptDebug(JSON.stringify(output, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("Seed failed:", message);
  process.exitCode = 1;
});
