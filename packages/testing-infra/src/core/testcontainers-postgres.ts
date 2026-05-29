import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

export const DEFAULT_POSTGRES_IMAGE = "postgres:16-alpine";

export async function startPostgresTestContainer(
  image: string = DEFAULT_POSTGRES_IMAGE,
): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(image).start();
}
