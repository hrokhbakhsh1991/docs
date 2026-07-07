import { getTranslations } from "next-intl/server";

import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { fetchWorkspaceExposureControlPlaneServer } from "@/exposure/fetch-exposure-control-plane.server";

import { ExposureControlPlaneClient } from "./exposure-control-plane-client";

export async function generateMetadata() {
  const t = await getTranslations("settings.exposure.controlPlane");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const dynamic = "force-dynamic";

export default async function ExposureControlPlanePage() {
  const session = await readOperatorSessionFromCookies();
  if (session === null) {
    return null;
  }

  const initialControlPlane =
    session.workspaceType === null
      ? null
      : await fetchWorkspaceExposureControlPlaneServer(session.workspaceType);

  return (
    <ExposureControlPlaneClient
      session={session}
      workspaceId={session.workspaceType}
      initialControlPlane={initialControlPlane}
    />
  );
}
