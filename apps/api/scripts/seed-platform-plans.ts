import { getPrismaAdmin } from "../src/db/prisma.ts";

const PLANS = [
  {
    id: "standard",
    displayName: "Standard",
    priceMonthly: null,
    features: { custom_domain: false, max_operators: 10 },
  },
  {
    id: "enterprise",
    displayName: "Enterprise",
    priceMonthly: null,
    features: { custom_domain: true, max_operators: 100 },
  },
] as const;

export async function seedPlatformPlans(): Promise<void> {
  const prisma = getPrismaAdmin();
  for (const plan of PLANS) {
    await prisma.platformPlan.upsert({
      where: { id: plan.id },
      create: {
        id: plan.id,
        displayName: plan.displayName,
        priceMonthly: plan.priceMonthly,
        currency: "IRR",
        features: plan.features,
      },
      update: {
        displayName: plan.displayName,
        priceMonthly: plan.priceMonthly,
        features: plan.features,
      },
    });
  }
}
