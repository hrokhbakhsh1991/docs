import { z } from "zod";

const optionalNonEmpty = z.string().min(1).optional();

/**
 * Cross-app boot validation (Phase 16.1). Fails fast when required deploy vars are missing.
 * API-specific vars remain in `apps/api/src/config/env.schema.ts`.
 */
/** API / worker boot — requires database connectivity. */
export const apiDeployEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: optionalNonEmpty,
  SENDGRID_API_KEY: optionalNonEmpty,
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: optionalNonEmpty,
  NEXT_PUBLIC_API_DYNAMIC_ORIGIN: z.enum(["true", "false"]).optional(),
});

/** Next.js boot — no DATABASE_URL (BFF talks to API over HTTP). */
export const webDeployEnvSchema = z.object({
  NEXT_PUBLIC_API_DYNAMIC_ORIGIN: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_API_PORT: z.string().min(1).optional(),
  NEXT_PUBLIC_TENANT_ROOT_DOMAIN: z.string().min(1).optional(),
});

export type ApiDeployEnv = z.infer<typeof apiDeployEnvSchema>;
export type WebDeployEnv = z.infer<typeof webDeployEnvSchema>;

function formatZodFailure(parsed: z.ZodSafeParseError<unknown>): string {
  return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
}

export function validateDeployEnv(env: NodeJS.ProcessEnv = process.env): ApiDeployEnv {
  const parsed = apiDeployEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid API deployment environment:\n${formatZodFailure(parsed)}`);
  }
  return parsed.data;
}

export function validateWebDeployEnv(env: NodeJS.ProcessEnv = process.env): WebDeployEnv {
  const parsed = webDeployEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid web deployment environment:\n${formatZodFailure(parsed)}`);
  }
  return parsed.data;
}
