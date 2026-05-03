import type { Metadata } from "next";

import { DashboardPageClient } from "./dashboard-page-client";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Leader workspace overview — registrations, tours, and bookings.",
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}
