import type { Metadata } from "next";

import { TourEditClient } from "./tour-edit-client";

export const metadata: Metadata = {
  title: "Edit tour",
  description: "Update tour details via the workspace API when configured.",
};

export default function EditTourPage({ params }: { params: { id: string } }) {
  return <TourEditClient tourId={params.id} />;
}
