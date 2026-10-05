import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";

import { PaymentDestinationSettingsClient } from "./payment-destination-settings-client";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "تنظیم مقصد پرداخت",
    description: "مدیریت مقصد پرداخت کارت‌به‌کارت workspace",
  };
}

export default async function PaymentDestinationSettingsPage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }
  return <PaymentDestinationSettingsClient session={session} />;
}
