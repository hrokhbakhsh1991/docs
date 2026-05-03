import type { Metadata } from "next";

import { ToursPageClient } from "./tours-page-client";

export const metadata: Metadata = {
  title: "Tours",
  description: "Tenant-scoped tour list — leader-owned tours only.",
};

export default function ToursPage() {
  return <ToursPageClient />;
}
