import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";

export type JwtKeyPair = {
  privatePem: string;
  publicPem: string;
};

/** Env knobs merged when binding a Testcontainers Postgres instance to `process.env`. */
export type TestContainerEnvConfig = {
  internalApiKey?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  authAllowDevStaticOtp?: boolean;
  disableOutboxProcessor?: boolean;
  disableReconciliation?: boolean;
  disablePaymentsTimeout?: boolean;
};

export type LoadDotEnvTestOptions = {
  /** Working directory for `.env.test.example` / `.env.test` (default `process.cwd()`). */
  cwd?: string;
};

export type ResetTestDatabaseOptions = {
  migrations: string[];
};

export type ApiE2eHarnessOptions = {
  postgresImage?: string;
  jwtKeys: JwtKeyPair;
  internalApiKey?: string;
  envOverrides?: Record<string, string>;
  /** When true, skip Testcontainers; expect `DATABASE_*` already set (CI external DB). */
  skipContainer?: boolean;
  cwd?: string;
  migrations?: string[];
  containerEnv?: TestContainerEnvConfig;
};

export type ApiE2eHarnessContext = {
  container: StartedPostgreSqlContainer | undefined;
  unavailableReason: string | null;
  applyEnv: () => void;
  resetDatabase: () => Promise<void>;
  teardown: () => Promise<void>;
};
