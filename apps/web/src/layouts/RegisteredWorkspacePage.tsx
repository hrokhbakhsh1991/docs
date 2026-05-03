"use client";

import { useEffect, type ReactNode } from "react";

import {
  Breadcrumb,
  PageContainer,
  PageShell,
  useAppLayoutChromeSetter,
  type BreadcrumbItem,
} from "@tour/ui";

export type RegisteredWorkspacePageProps = {
  title: string;
  description?: string;
  breadcrumbItems: BreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
  documentTitle?: string;
};

function crumbSig(items: BreadcrumbItem[]) {
  return items.map((i) => `${i.label}\u0000${i.href ?? ""}`).join("\u0001");
}

/**
 * Registers `@tour/ui` app chrome (breadcrumb / title / actions) and wraps body in PageShell + PageContainer.
 */
export function RegisteredWorkspacePage({
  title,
  description,
  breadcrumbItems,
  actions,
  children,
  documentTitle,
}: RegisteredWorkspacePageProps) {
  const setChrome = useAppLayoutChromeSetter();
  const crumbKey = crumbSig(breadcrumbItems);

  useEffect(() => {
    setChrome({
      title,
      description,
      breadcrumb: <Breadcrumb items={breadcrumbItems} />,
      actions,
    });
    return () => setChrome(null);
  }, [title, description, actions, setChrome, crumbKey]); // eslint-disable-line react-hooks/exhaustive-deps -- breadcrumbItems → crumbKey

  return (
    <PageShell documentTitle={documentTitle ?? title}>
      <PageContainer>{children}</PageContainer>
    </PageShell>
  );
}
