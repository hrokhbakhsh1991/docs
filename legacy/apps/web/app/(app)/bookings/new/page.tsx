import type { Metadata } from "next";

import { NewBookingLanding } from "../new-booking-landing";

export const metadata: Metadata = {
  title: "New registration",
  description: "Start registration by choosing a tour.",
};

export default function NewBookingPage() {
  return <NewBookingLanding />;
}
