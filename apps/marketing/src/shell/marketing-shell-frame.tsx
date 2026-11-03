"use client";

import type { ReactNode } from "react";
import { useMarketingSession } from "@/auth/marketing-session-context";

export function MarketingShellFrame({
  initiallyAuthenticated,
  children,
}: {
  readonly initiallyAuthenticated: boolean;
  readonly children: ReactNode;
}) {
  const session = useMarketingSession();
  const authenticated = session?.authenticated ?? initiallyAuthenticated;
  return (
    <div
      data-marketing-shell
      data-slot="shell"
      {...(authenticated ? { "data-marketing-member-authenticated": "" } : {})}
    >
      {children}
    </div>
  );
}
