import type { Metadata } from "next";

import { RegisterForTourClient } from "./register-for-tour-client";

export const metadata: Metadata = {
  title: "Register for tour",
  description:
    "Register for a tour. This page loads tour details via GET /api/v2/tours/{tourId} and submits a registration via POST /api/v2/tours/{tourId}/register.",
};

export default function TourRegisterPage({ params }: { params: { id: string } }) {
  return <RegisterForTourClient tourId={params.id} />;
}
