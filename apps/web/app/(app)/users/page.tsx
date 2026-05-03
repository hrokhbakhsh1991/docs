import type { Metadata } from "next";
import dynamic from "next/dynamic";

const UsersPageClient = dynamic(
  () => import("./users-page-client").then((m) => m.UsersPageClient),
  { loading: () => <p>Loading users…</p> }
);

export const metadata: Metadata = {
  title: "Users",
  description: "Admin users directory.",
};

export default function UsersPage() {
  return <UsersPageClient />;
}
