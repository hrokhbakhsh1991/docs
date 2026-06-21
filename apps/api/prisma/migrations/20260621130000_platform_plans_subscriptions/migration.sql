-- P2-C: platform SaaS plans and tenant subscriptions.
CREATE TABLE "platform_plans" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "price_monthly" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "features" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_subscriptions" (
    "tenant_id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_period_end" TIMESTAMPTZ,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("tenant_id")
);

CREATE INDEX "idx_tenant_subscriptions_plan_id" ON "tenant_subscriptions"("plan_id");

ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
