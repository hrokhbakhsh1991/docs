import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/shell/app-shell";
import { resolveBootstrapAppSessionForHost } from "@/tenant/tenant-kernel";

/** Phase 3 public/wizard chrome — not used under `(app)/`. */
export async function Phase3ShellLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const resolved = await resolveBootstrapAppSessionForHost(host);
  return <AppShell pluginId={resolved.session.pluginId}>{children}</AppShell>;
}
