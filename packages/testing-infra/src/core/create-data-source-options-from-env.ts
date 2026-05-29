import type { DataSourceOptions } from "typeorm";

/**
 * Standalone TypeORM options from `process.env` (no Nest ConfigService).
 * Aligns with `apps/api/src/database/database.config.ts` for e2e reset scripts.
 */
export function createDataSourceOptionsFromEnv(
  migrations: string[],
): DataSourceOptions {
  return {
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 5432,
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    synchronize: false,
    logging: false,
    migrationsTableName: "typeorm_migrations",
    migrationsTransactionMode: "each",
    migrations,
  };
}
