import { redirect } from "next/navigation";

/**
 * DL-40 — bare `/me` namespace root redirects to default primary module.
 * Phase 1 interim: frozen alias until PS-2 registry (DL-06).
 */
export default function MeIndexPage() {
  redirect("/me/registrations");
}
