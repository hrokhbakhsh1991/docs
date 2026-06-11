import type { ReactNode } from "react";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";

import { TourWorkspaceLayoutClient } from "./tour-workspace-layout-client";

export const dynamic = "force-dynamic";

type TourWorkspaceLayoutProps = {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
};

export default async function TourWorkspaceLayout({ children, params }: TourWorkspaceLayoutProps) {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  const { id } = await params;
  return (
    <TourWorkspaceLayoutClient session={session} tourId={id}>
      {children}
    </TourWorkspaceLayoutClient>
  );
}
