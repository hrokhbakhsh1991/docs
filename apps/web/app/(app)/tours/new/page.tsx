import type { Metadata } from "next";

import { TourCreateClient } from "@/features/tours/components/tour-create-client";

/** Types only — Zod schema stays client-side (`TourCreateClient` imports `TourCreateSchema`). */
export type { TourCreateModel } from "@/features/tours/models/tourCreateModel";

export const metadata: Metadata = {
  title: "Create tour",
  description: "Add a new tour via the workspace API when configured.",
};

export default function NewTourPage() {
  return <TourCreateClient />;
}
