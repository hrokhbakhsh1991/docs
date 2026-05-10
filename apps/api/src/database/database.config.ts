import { DataSource, type DataSourceOptions } from "typeorm";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ConfigService } from "../config/config.service";

const isTs = Boolean(process.env.TS_MIGRATIONS);
/** Nest emits migrations under dist/apps/api/src/database/migrations (single glob; avoids duplicate dist globs). */
const migrations = isTs
  ? ["src/database/migrations/*.ts"]
  : ["dist/apps/api/src/database/migrations/*.js"];

export function createTypeOrmOptions(
  configService: ConfigService
): TypeOrmModuleOptions {
  const db = configService.getDatabaseConfig();

  return {
    type: "postgres",
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.name,
    synchronize: false,
    autoLoadEntities: true,
    logging: false,
    migrationsTableName: "typeorm_migrations",
    migrationsTransactionMode: "each",
    migrations
  };
}

export function createDataSourceOptionsFromEnv(): DataSourceOptions {
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
    migrations
  };
}

export default new DataSource(createDataSourceOptionsFromEnv());
