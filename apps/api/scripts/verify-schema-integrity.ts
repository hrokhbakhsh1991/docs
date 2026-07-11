import { getPrisma, getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { DENALI_SMOKE_TENANT_ID } from "../src/settings/resolve-workspace-dev-smoke-tenant";

async function verify() {
  const prisma = getPrisma();
  const prismaAdmin = getPrismaAdmin();

  console.log(`[INTEGRATION-CHECK] Verifying Denali Smoke Tenant ID: ${DENALI_SMOKE_TENANT_ID}`);

  const adminResult = await prismaAdmin.tenant.findUnique({
    where: { id: DENALI_SMOKE_TENANT_ID },
  });
  console.log("[INTEGRATION-CHECK] Admin pool tenant lookup:", adminResult);

  const appResult = await prisma.tenant.findUnique({
    where: { id: DENALI_SMOKE_TENANT_ID },
  });
  console.log("[INTEGRATION-CHECK] App pool tenant lookup:", appResult);

  try {
    const rlsResult = await withTenantRls(DENALI_SMOKE_TENANT_ID, async (tx) => {
      return tx.tenant.findUnique({
        where: { id: DENALI_SMOKE_TENANT_ID },
      });
    });
    console.log("[INTEGRATION-CHECK] withTenantRls tenant lookup:", rlsResult);
  } catch (err: unknown) {
    console.error("[INTEGRATION-CHECK] withTenantRls lookup failed:", err);
  }
  
  await prisma.$disconnect();
  await prismaAdmin.$disconnect();
}

verify().catch(console.error);
