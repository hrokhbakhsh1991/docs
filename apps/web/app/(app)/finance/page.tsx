import type { Metadata } from "next";
import dynamic from "next/dynamic";

import { FINANCE_ROUTE_COPY } from "./finance-copy";

const FinancePageClient = dynamic(
  () => import("./finance-page-client").then((m) => m.FinancePageClient),
  { loading: () => <p style={{ padding: "1rem" }}>در حال بارگذاری…</p> },
);

export const metadata: Metadata = {
  title: FINANCE_ROUTE_COPY.metadata.title,
  description: FINANCE_ROUTE_COPY.metadata.description,
};

export default function FinancePage() {
  return <FinancePageClient />;
}
