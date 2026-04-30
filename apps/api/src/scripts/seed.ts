import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as argon2 from "argon2";
import { DataSource, IsNull } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
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
    console.log(`Seed complete. Output written to ${outputPath}`);
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("Seed failed:", message);
  process.exitCode = 1;
});
