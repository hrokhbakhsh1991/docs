import { cookies } from "next/headers";

export type MemberSelfRegistrationRef = {
  readonly id: string;
  readonly status: string;
};

/** SSR — active self registration on a tour for the signed-in member (Denali). */
export async function fetchMemberSelfRegistrationForTour(
  host: string,
  tourId: string
): Promise<MemberSelfRegistrationRef | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (cookieHeader.length === 0) {
    return null;
  }

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  try {
    const res = await fetch(
      `${protocol}://${host}/api/me/registrations/for-tour?tourId=${encodeURIComponent(tourId)}`,
      {
        method: "GET",
        headers: { cookie: cookieHeader },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json()) as {
      ok?: boolean;
      data?: { self?: { id: string; status: string } | null };
    };
    const self = payload.data?.self;
    if (self === null || self === undefined || typeof self.id !== "string") {
      return null;
    }
    return { id: self.id, status: self.status };
  } catch {
    return null;
  }
}
