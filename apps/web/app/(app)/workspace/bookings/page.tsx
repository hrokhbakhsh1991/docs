import { redirect } from "next/navigation";

/** Legacy global path — operator bookings Command Center. */
export default function WorkspaceBookingsAliasPage() {
  redirect("/bookings");
}
