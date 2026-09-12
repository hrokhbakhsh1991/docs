import { redirect } from "next/navigation";

/** Legacy segment — receipts queue tab on finance Command Center. */
export default function FinanceReceiptsAliasPage() {
  redirect("/finance?tab=receipts");
}
