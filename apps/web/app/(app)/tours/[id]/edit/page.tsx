import type { Metadata } from "next";
import { cookies } from "next/headers";

import { decodeJwtPayload } from "@/lib/auth/decode-jwt-payload";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";

import { TourEditClient, type TourEditInitialSession } from "./tour-edit-client";

export const metadata: Metadata = {
  title: "Edit tour",
  description: "Update tour details via the workspace API when configured.",
};

export default async function EditTourPage({ params }: { params: { id: string } }) {
  const token = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  const claims = token ? decodeJwtPayload(token) : null;
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
  const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
  const initialSession: TourEditInitialSession | null =
    userId && tenantId ? { userId, tenantId, role } : null;

  return <TourEditClient tourId={params.id} initialSession={initialSession} />;
}
