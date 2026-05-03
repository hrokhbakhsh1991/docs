import type { ReactNode } from "react";

import { AppLayout, AppLayoutProvider } from "@tour/ui";

import { WorkspaceShell } from "@/layouts/AppLayout";

import { TourOpsQueryProvider } from "./query-client-provider";

export default function AppSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceShell>
      <AppLayoutProvider>
        <AppLayout>
          <TourOpsQueryProvider>
            {children}
          </TourOpsQueryProvider>
        </AppLayout>
      </AppLayoutProvider>
    </WorkspaceShell>
  );
}
