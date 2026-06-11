"use client";

import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

import { SheetTitle } from "@/components/ui/sheet";

export function OperatorSheetTitle() {
  const title = useTenantBrandTitle();
  return <SheetTitle>{title}</SheetTitle>;
}
