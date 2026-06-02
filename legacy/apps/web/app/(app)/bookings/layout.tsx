import type { ReactNode } from "react";

import { assertParticipantBookingsRoute } from "@/lib/auth/require-participant-bookings-route";

export default function BookingsLayout({ children }: { children: ReactNode }) {
  assertParticipantBookingsRoute();
  return children;
}
