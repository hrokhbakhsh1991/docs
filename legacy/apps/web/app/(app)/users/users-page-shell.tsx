import type { ReactNode } from "react";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { USERS_ROUTE_COPY } from "./users-copy";

const copy = USERS_ROUTE_COPY.list;

const breadcrumbItems = [
  { label: copy.breadcrumbHome, href: "/dashboard" },
  { label: copy.breadcrumbUsers },
] as const;

type UsersDirectoryPageShellProps = {
  children: ReactNode;
};

/** Workspace chrome + standard `/users` breadcrumbs and titles. */
export function UsersDirectoryPageShell({ children }: UsersDirectoryPageShellProps) {
  return (
    <RegisteredWorkspacePage
      documentTitle={copy.documentTitle}
      title={copy.pageTitle}
      description={copy.pageDescription}
      breadcrumbItems={[...breadcrumbItems]}
    >
      {children}
    </RegisteredWorkspacePage>
  );
}
