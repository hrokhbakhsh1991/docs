import type { Metadata } from "next";

import { RegisterForTourClient } from "./register-for-tour-client";

export const metadata: Metadata = {
  title: "Register for tour",
  description: "Submit registration for a tour via POST /api/v2/bookings.",
};

export default function TourRegisterPage({ params }: { params: { id: string } }) {
  return <RegisterForTourClient tourId={params.id} />;
}
