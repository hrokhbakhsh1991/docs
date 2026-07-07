import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import { MaintenancePage } from "@/platform/maintenance-page";

export default async function PricingPage() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  if (!isPlatformMotherHost(host)) {
    notFound();
  }
  return <MaintenancePage title="قیمت‌گذاری" />;
}
