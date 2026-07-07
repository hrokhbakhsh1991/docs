import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { toPlatformPlanDto } from "../../platform/platform-plan.dto.ts";
import { PlatformPlanRepository } from "../../platform/platform-plan.repository.ts";
import { PlatformUnauthorized } from "../../platform/platform.errors.ts";

export async function handlePlatformPlansList(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>);
  } catch (err: unknown) {
    if (err instanceof PlatformUnauthorized || (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
      return;
    }
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
    return;
  }

  try {
    const plans = await new PlatformPlanRepository().listAll();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ items: plans.map(toPlatformPlanDto) }));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
