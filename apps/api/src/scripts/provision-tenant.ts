import { provisionWorkspaceTenant } from "./provision-workspace-tenant";
import { resolveTenantSlugFromArgv } from "./verify-workspace-tenant";

function readArgValue(argv: readonly string[], key: string): string | undefined {
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg.startsWith(`${key}=`)) {
      const v = arg.slice(key.length + 1).trim();
      return v || undefined;
    }
  }
  return undefined;
}

const argv = process.argv.slice(2);
const slug = resolveTenantSlugFromArgv(argv);

const modulesRaw = readArgValue(argv, "--modules");
const modules = modulesRaw
  ? modulesRaw
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
  : undefined;

provisionWorkspaceTenant(slug, {
  name: readArgValue(argv, "--name"),
  ownerEmail: readArgValue(argv, "--owner-email"),
  ownerPassword: readArgValue(argv, "--owner-password"),
  modules,
}).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
