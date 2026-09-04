let ticketNumberCounter = 0;

export function nextPostgresTestTicketNumber(): number {
  ticketNumberCounter += 1;
  return ticketNumberCounter;
}

export function resetPostgresTestTicketNumbers(): void {
  ticketNumberCounter = 0;
}

type PrismaRolePostureClient = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * Ticketing Postgres specs require DATABASE_URL as app_tour (NOSUPERUSER, NOBYPASSRLS).
 * Running with postgres superuser silently disables RLS and invalidates isolation proofs.
 */
export async function assertPostgresAppRoleForRlsTests(
  prisma: PrismaRolePostureClient,
): Promise<void> {
  const [{ rolsuper, rolbypassrls }] = await prisma.$queryRaw<
    { rolsuper: boolean; rolbypassrls: boolean }[]
  >`
    SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  if (rolsuper) {
    throw new Error(
      "DATABASE_URL must use app_tour (NOSUPERUSER) — superuser bypasses RLS and invalidates ticketing isolation tests",
    );
  }
  if (rolbypassrls) {
    throw new Error(
      "DATABASE_URL role must have NOBYPASSRLS — migrate as DATABASE_URL_ADMIN (20260706120000_app_cloud_nobypassrls)",
    );
  }
}
