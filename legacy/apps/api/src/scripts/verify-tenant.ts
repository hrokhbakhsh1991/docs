import { resolveTenantSlugFromArgv, verifyWorkspaceTenant } from "./verify-workspace-tenant";

const slug = resolveTenantSlugFromArgv(process.argv.slice(2));

verifyWorkspaceTenant(slug).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
