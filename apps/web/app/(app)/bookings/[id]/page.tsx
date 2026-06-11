import { redirect } from "next/navigation";

type BookingDetailAliasPageProps = {
  readonly params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

/** DEC-P9-011 — deep link alias to Command Center inspection panel. */
export default async function BookingDetailAliasPage({ params }: BookingDetailAliasPageProps) {
  const { id } = await params;
  const bookingId = id.trim();
  if (bookingId.length === 0) {
    redirect("/bookings");
  }
  redirect(`/bookings?bookingId=${encodeURIComponent(bookingId)}`);
}
