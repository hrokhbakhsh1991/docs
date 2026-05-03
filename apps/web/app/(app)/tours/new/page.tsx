import type { Metadata } from "next";

import { TourCreateClient } from "./tour-create-client";

export const metadata: Metadata = {
  title: "Create tour",
  description: "Add a new tour via the workspace API when configured.",
};

export default function NewTourPage() {
  return <TourCreateClient />;
}
