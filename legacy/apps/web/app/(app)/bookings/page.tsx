import type { Metadata } from "next";
import dynamic from "next/dynamic";

const BookingsPageClient = dynamic(
  () => import("./bookings-page-client").then((m) => m.BookingsPageClient),
  { loading: () => <p>Loading bookings…</p> }
);

export const metadata: Metadata = {
  title: "Bookings",
  description: "Booking queue and registration pipeline.",
};

export default function BookingsPage() {
  return <BookingsPageClient />;
}
