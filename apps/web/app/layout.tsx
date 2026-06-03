import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/providers/app-providers";
import { AppShell } from "@/shell/app-shell";
import {
  resolveBootstrapAppSession,
  toSerializableBootstrap,
} from "@/tenant/tenant-kernel";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tour Ops",
  description: "Platform web shell (Phase 3)",
};

/** Session is resolved per request — do not prerender with module-static dev identity. */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  const bootstrap = toSerializableBootstrap(resolveBootstrapAppSession());

  return (
    <html lang="en">
      <body>
        <AppProviders bootstrap={bootstrap}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
