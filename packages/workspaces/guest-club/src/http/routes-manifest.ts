export const GUEST_CLUB_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: "GET" | "POST";
  readonly path: string;
}[] = [
  { method: "GET", path: "/guest-club/catalog" },
  { method: "GET", path: "/guest-club/catalog/:tourId" },
  { method: "POST", path: "/guest-club/registrations" },
] as const;
