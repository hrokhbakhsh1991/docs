import { redirect } from "next/navigation";

/** Legacy segment — finance Command Center lives at `/finance`. */
export default function FinanceHubAliasPage() {
  redirect("/finance");
}
