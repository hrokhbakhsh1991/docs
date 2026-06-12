export async function fetchReverseGeocodeAddress(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/geocoding/reverse?lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`,
      { credentials: "include" }
    );
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { address?: string | null };
    if (typeof body.address === "string" && body.address.trim().length > 0) {
      return body.address.trim();
    }
    return null;
  } catch {
    return null;
  }
}
