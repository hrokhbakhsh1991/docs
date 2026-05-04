/**
 * Inserts deterministic fake tours for leader@test.com's tenant (idempotent by title + tenant_id).
 * Run from apps/api: pnpm seed:demo-leader-tours
 */
import { DataSource, IsNull } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";
import { TourEntity, TourLifecycleStatus } from "../modules/tours/entities/tour.entity";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";

const LEADER_EMAIL = "leader@test.com";

const DEMO_TOURS: Array<{
  title: string;
  description: string;
  totalCapacity: number;
  acceptedCount: number;
  lifecycleStatus: TourLifecycleStatus;
  chatLink?: string;
  costContext: Record<string, unknown>;
}> = [
  {
    title: "[Demo] کویر نمونه — آخر هفته",
    description: "تور نمونه برای تست UI؛ ظرفیت و پذیرش‌ها فیک هستند.",
    totalCapacity: 36,
    acceptedCount: 9,
    lifecycleStatus: TourLifecycleStatus.OPEN,
    chatLink: "https://example.com/demo-chat/kavir",
    costContext: { base: 1250000, requiresPayment: true, currency: "IRR" }
  },
  {
    title: "[Demo] مسیر ساحلی شمال",
    description: "لیست رزرو و وضعیت پرداخت را در اپ می‌توانی تست کنی.",
    totalCapacity: 28,
    acceptedCount: 14,
    lifecycleStatus: TourLifecycleStatus.OPEN,
    chatLink: "https://example.com/demo-chat/coast",
    costContext: { base: 980000, requiresPayment: true, currency: "IRR" }
  },
  {
    title: "[Demo] گردش شهری (پیش‌نویس)",
    description: "تور در وضعیت DRAFT؛ هنوز باز نشده برای ثبت‌نام عمومی.",
    totalCapacity: 24,
    acceptedCount: 0,
    lifecycleStatus: TourLifecycleStatus.DRAFT,
    costContext: { base: 450000, requiresPayment: false }
  },
  {
    title: "[Demo] تور تکمیل‌شده (بسته)",
    description: "ظرفیت پر شده؛ برای نمایش وضعیت CLOSED در لیست.",
    totalCapacity: 20,
    acceptedCount: 20,
    lifecycleStatus: TourLifecycleStatus.CLOSED,
    costContext: { base: 600000, requiresPayment: true, currency: "IRR" }
  }
];

async function run(): Promise<void> {
  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity, TourEntity]
  });

  await dataSource.initialize();
  try {
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(UserTenantEntity);
    const tourRepo = dataSource.getRepository(TourEntity);

    const leader = await userRepo.findOne({
      where: { email: LEADER_EMAIL, deletedAt: IsNull() }
    });
    if (!leader) {
      throw new Error(`User not found: ${LEADER_EMAIL}. Run seed or auth alignment first.`);
    }

    const membership = await membershipRepo.findOne({
      where: { userId: leader.id, deletedAt: IsNull() }
    });
    if (!membership) {
      throw new Error(`No tenant membership for ${LEADER_EMAIL}.`);
    }

    const tenantId = membership.tenantId;
    let inserted = 0;
    let skipped = 0;

    for (const spec of DEMO_TOURS) {
      const exists = await tourRepo.findOne({
        where: {
          tenantId,
          title: spec.title,
          deletedAt: IsNull()
        }
      });
      if (exists) {
        skipped += 1;
        continue;
      }
      await tourRepo.save(
        tourRepo.create({
          tenantId,
          title: spec.title,
          description: spec.description,
          totalCapacity: spec.totalCapacity,
          acceptedCount: spec.acceptedCount,
          lifecycleStatus: spec.lifecycleStatus,
          chatLink: spec.chatLink,
          costContext: spec.costContext
        })
      );
      inserted += 1;
    }

    emitScriptInfo(`Demo tours for ${LEADER_EMAIL} @ tenant ${tenantId}: inserted=${inserted}, skipped(already present)=${skipped}`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(
    "seed-demo-leader-tours failed:",
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exitCode = 1;
});
