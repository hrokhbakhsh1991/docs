import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DataSource } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";

function loadEnvFile(relativeName: string): void {
  const envPath = resolve(process.cwd(), relativeName);
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function run(): Promise<void> {
  loadEnvFile(".env");
  loadEnvFile(".env.test");
  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    console.log("Migrations applied successfully.");
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("Migration run failed:", message);
  process.exitCode = 1;
});
