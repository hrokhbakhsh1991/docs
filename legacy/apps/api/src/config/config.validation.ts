import { validateDeployEnv } from "@repo/config/env-validation";
import { envSchema } from "./env.schema";
import type { EnvVariables } from "./env.types";

const CRITICAL_ENV_KEYS = [
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "DATABASE_URL",
  "NODE_ENV"
] as const;

export function validateEnvironmentOrThrow(env: NodeJS.ProcessEnv): EnvVariables {
  validateDeployEnv(env);
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${formattedErrors}`);
  }

  for (const key of CRITICAL_ENV_KEYS) {
    const value = result.data[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Missing or invalid critical env variable: ${key}`);
    }
  }

  return result.data;
}
