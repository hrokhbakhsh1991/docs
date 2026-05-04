import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as argon2 from "argon2";
import { DataSource, IsNull } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptDebug, emitScriptInfo } from "./script-log";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";
import { Role } from "../modules/auth/roles.enum";
import { TourEntity, TourLifecycleStatus } from "../modules/tours/entities/tour.entity";

type SeedOutput = {
  seededAt: string;
  tenantId: string;
  tenantName: string;
  user: {
    id: string;
    email: string;
    password: string;
    role: string;
  };
  tours: Array<{
    id: string;
    title: string;
    totalCapacity: number;
    acceptedCount: number;
  }>;
};

async function run(): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity, TourEntity]
  });

  await dataSource.initialize();
  try {
    const tenantRepo = dataSource.getRepository(TenantEntity);
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(UserTenantEntity);
    const tourRepo = dataSource.getRepository(TourEntity);

    // Local-dev deterministic leader account requested by product/dev workflows.
    const localTenantName = "demo-tenant";
    const localLeaderEmail = "leader@test.com";
    const localLeaderPassword = "demo123";

    let localTenant = await tenantRepo.findOne({
      where: { name: localTenantName, deletedAt: IsNull() }
    });
    if (!localTenant) {
      localTenant = await tenantRepo.save(
        tenantRepo.create({
          name: localTenantName,
          description: "Local development tenant for deterministic login"
        })
      );
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
          hashedPassword: localHashedPassword,
          fullName: "Local Demo Leader",
          isEmailVerified: true,
          telegramUserId: null
        })
      );
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
          role: Role.OWNER
        })
      );
    }

    const tenantName = `Freeze QA Tenant ${new Date().toISOString()}`;
    const seededTenant = await tenantRepo.save(
      tenantRepo.create({
        name: tenantName,
        description: "Seeded tenant for backend freeze E2E validation"
      })
    );

    const userEmail = `freeze.qa.${Date.now()}@example.com`;
    const userPassword = "Passw0rd!";
    const hashedPassword = await argon2.hash(userPassword);
    const seededUser = await userRepo.save(
      userRepo.create({
        email: userEmail,
        hashedPassword,
        fullName: "Freeze QA Leader",
        isEmailVerified: true,
        telegramUserId: null
      })
    );

    await membershipRepo.save(
      membershipRepo.create({
        tenantId: seededTenant.id,
        userId: seededUser.id,
        role: Role.OWNER
      })
    );

    const tourTemplates = [
      "Freeze QA Tour Alpha",
      "Freeze QA Tour Beta",
      "Freeze QA Tour Gamma"
    ];
    const seededTours: TourEntity[] = [];
    for (const title of tourTemplates) {
      const existing = await tourRepo.findOne({
        where: { tenantId: seededTenant.id, title, deletedAt: IsNull() }
      });
      if (existing) {
        seededTours.push(existing);
        continue;
      }
      const created = await tourRepo.save(
        tourRepo.create({
          tenantId: seededTenant.id,
          title,
          description: `${title} seeded for freeze validation`,
          totalCapacity: 40,
          acceptedCount: 0,
          lifecycleStatus: TourLifecycleStatus.OPEN,
          costContext: { base: 100, requiresPayment: true }
        })
      );
      seededTours.push(created);
    }

    const output: SeedOutput = {
      seededAt: new Date().toISOString(),
      tenantId: seededTenant.id,
      tenantName,
      user: {
        id: seededUser.id,
        email: userEmail,
        password: userPassword,
        role: Role.OWNER
      },
      tours: seededTours.map((tour) => ({
        id: tour.id,
        title: tour.title,
        totalCapacity: tour.totalCapacity,
        acceptedCount: tour.acceptedCount
      }))
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
