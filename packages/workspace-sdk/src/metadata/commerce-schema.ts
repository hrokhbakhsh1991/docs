import { z } from "zod";

export const WORKSPACE_PAYMENT_MODES = ["offline_receipt", "gateway"] as const;
export const WORKSPACE_GATEWAY_PROVIDERS = ["zibal", "stripe"] as const;

export type WorkspacePaymentMode = (typeof WORKSPACE_PAYMENT_MODES)[number];
export type WorkspaceGatewayProvider = (typeof WORKSPACE_GATEWAY_PROVIDERS)[number];

export const workspaceCommerceConfigSchema = z
  .object({
    paymentMode: z.enum(WORKSPACE_PAYMENT_MODES).default("offline_receipt"),
    gatewayProvider: z.enum(WORKSPACE_GATEWAY_PROVIDERS).nullable().default(null),
    currency: z.string().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.paymentMode === "gateway" && value.gatewayProvider == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gatewayProvider"],
        message: "gatewayProvider is required when paymentMode is gateway",
      });
    }
    if (value.paymentMode === "gateway" && value.currency.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currency"],
        message: "currency is required when paymentMode is gateway",
      });
    }
    if (value.paymentMode === "offline_receipt" && value.gatewayProvider != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gatewayProvider"],
        message: "gatewayProvider must be null when paymentMode is offline_receipt",
      });
    }
  });

export type WorkspaceCommerceConfig = z.infer<typeof workspaceCommerceConfigSchema>;

export const DEFAULT_WORKSPACE_COMMERCE_CONFIG: WorkspaceCommerceConfig =
  workspaceCommerceConfigSchema.parse({});

export function parseWorkspaceCommerceConfig(input: unknown): WorkspaceCommerceConfig {
  return workspaceCommerceConfigSchema.parse(input);
}

export function safeParseWorkspaceCommerceConfig(
  input: unknown
): z.SafeParseReturnType<unknown, WorkspaceCommerceConfig> {
  return workspaceCommerceConfigSchema.safeParse(input);
}
