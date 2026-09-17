import { redirect } from "next/navigation";

import { workspaceBasePath } from "@/features/tours/tour-workspace-logic";

type TourDetailAliasPageProps = {
  readonly params: Promise<{ id: string }>;
};

/** Legacy `/tours/{id}` — canonical operator surface is tour workspace (TR-02). */
export default async function TourDetailAliasPage({ params }: TourDetailAliasPageProps) {
  const { id } = await params;
  const tourId = id.trim();
  if (tourId.length === 0) {
    redirect("/tours");
  }
  redirect(workspaceBasePath(tourId));
}
