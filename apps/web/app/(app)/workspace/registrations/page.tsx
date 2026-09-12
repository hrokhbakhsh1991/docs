import { redirect } from "next/navigation";

/** Legacy global path — registrations are tour-scoped under `/tours/{id}/workspace`. */
export default function WorkspaceRegistrationsAliasPage() {
  redirect("/tours");
}
