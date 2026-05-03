import type { Metadata } from "next";

import { BookingDetailClient } from "../booking-detail-client";

export const metadata: Metadata = {
  title: "Registration details",
  description: "Track registration status, participant info, tour, and payment.",
};

export default function RegistrationDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { checkout?: string };
}) {
  return (
    <BookingDetailClient
      registrationId={params.id}
      highlightPaymentCheckout={searchParams?.checkout === "1"}
    />
  );
}
