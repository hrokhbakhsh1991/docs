import type { Metadata } from "next";

import { BookingDetailClient } from "../../booking-detail-client";

export const metadata: Metadata = {
  title: "Registration details",
  description: "View registration and payment status.",
};

/** Legacy path: same participant-facing detail as `/bookings/[id]`. */
export default function BookingEditAliasPage({ params }: { params: { id: string } }) {
  return <BookingDetailClient registrationId={params.id} />;
}
