import { cookies } from "next/headers";

export type MemberRegistrationItem = {
  readonly id: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly partySize?: number;
  readonly guestLabel?: string;
  readonly registrantTarget?: "self" | "other";
  readonly transportKind?: "primary" | "personal_car" | "no_car_dong" | "no_car_acquaintance";
  readonly personalCarOccupants?: 1 | 2 | 3;
  readonly dueCurrency?: string;
  readonly dueTotalMinor?: string;
  readonly dueLines?: readonly {
    readonly code: "trip" | "dong" | "transport";
    readonly amountMinor: string;
  }[];
};

type MemberRegistrationsBffResponse = {
  readonly ok: boolean;
  readonly data?: {
    readonly items?: readonly MemberRegistrationItem[];
  };
};

export async function fetchMemberRegistrations(host: string): Promise<MemberRegistrationItem[]> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  if (cookieHeader.length === 0) {
    return [];
  }

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  let res: Response;
  try {
    res = await fetch(`${protocol}://${host}/api/me/registrations`, {
      method: "GET",
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    return [];
  }

  if (!res.ok) {
    return [];
  }

  const payload = (await res.json()) as MemberRegistrationsBffResponse;
  if (payload.ok !== true) {
    return [];
  }

  return [...(payload.data?.items ?? [])];
}
