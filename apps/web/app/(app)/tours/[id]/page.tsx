import type { Metadata } from "next";

import { TourDetailClient } from "./tour-detail-client";

export const metadata: Metadata = {
  title: "Tour details",
  description: "Read-only tour snapshot.",
};

export default function TourDetailPage({ params }: { params: { id: string } }) {
  return <TourDetailClient tourId={params.id} />;
}
