import { PAGE_REGISTRY } from "@repo/shared-contracts";
import type { Metadata } from "next";

import { PageRenderer } from "@/features/content/components/PageRenderer";

const page = PAGE_REGISTRY.outdoor_pilot.landing;

export const metadata: Metadata = {
  title: page.route.title ?? "Registry smoke — Outdoor Pilot landing",
  description: page.route.metaDescription,
};

/**
 * Internal smoke route — renders `PAGE_REGISTRY.outdoor_pilot.landing` through {@link PageRenderer}.
 * Visit `/test-registry` (requires session like other app routes).
 */
export default function TestRegistryPage() {
  return <PageRenderer page={page} />;
}
