import { headers } from "next/headers";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { listPlatformNavItems } from "@/platform/platform-nav";
import { PlatformShell } from "@/platform/platform-shell";
import { readPlatformOpsSessionFromCookies } from "@/platform/read-platform-session.server";
import { requirePlatformOpsSessionWeb } from "@/platform/require-platform-ops-session";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "/platform";
  const session = await readPlatformOpsSessionFromCookies();
  const gate = requirePlatformOpsSessionWeb({ session, pathname });
  if (!gate.allowed) {
    redirect(gate.redirectTo);
  }

  if (pathname === "/auth/login" || pathname.startsWith("/auth/login/")) {
    return children;
  }

  return (
    <PlatformShell session={session!} navItems={listPlatformNavItems()}>
      {children}
    </PlatformShell>
  );
}
