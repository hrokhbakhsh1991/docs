/**
 * @deprecated Prefer `verify-workspace-tenant.ts --slug=denali` or `pnpm verify:tenant`.
 */
import { verifyWorkspaceTenant } from "./verify-workspace-tenant";

verifyWorkspaceTenant("denali").catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
