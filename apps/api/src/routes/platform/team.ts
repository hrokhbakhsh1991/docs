import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import {
  assertPlatformOpsOwnerRole,
  assertPlatformOpsWriteRole,
} from "../../platform/assert-platform-ops-role.ts";
import { parseCreatePlatformTeamMemberBody } from "../../platform/create-platform-team-member.schema.ts";
import { toPlatformTeamMemberDto } from "../../platform/platform-team.dto.ts";
import { PlatformOpsUserRepository } from "../../platform/platform-ops-user.repository.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
  PlatformValidation,
} from "../../platform/platform.errors.ts";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
  }
  return rawBody.length > 0 ? JSON.parse(rawBody) : {};
}

function writePlatformAuthError(res: ServerResponse, err: unknown): boolean {
  if (err instanceof PlatformUnauthorized || (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED") {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
    return true;
  }
  if (err instanceof PlatformForbidden || (err as { code?: string })?.code === "PLATFORM_FORBIDDEN") {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
    return true;
  }
  return false;
}

export async function handlePlatformTeam(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { repository?: PlatformOpsUserRepository } = {}
): Promise<void> {
  const repository = deps.repository ?? new PlatformOpsUserRepository();

  if (req.method === "GET") {
    try {
      await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>, { repository });
    } catch (err: unknown) {
      if (writePlatformAuthError(res, err)) return;
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
      return;
    }

    const items = await repository.listAll();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ items: items.map(toPlatformTeamMemberDto) }));
    return;
  }

  if (req.method === "POST") {
    let ctx;
    try {
      ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>, {
        repository,
      });
      assertPlatformOpsWriteRole(ctx);
      assertPlatformOpsOwnerRole(ctx);
    } catch (err: unknown) {
      if (writePlatformAuthError(res, err)) return;
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
      return;
    }

    try {
      const body = parseCreatePlatformTeamMemberBody(await readJsonBody(req));
      const member = await repository.upsert({ phone: body.phone, role: body.role });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ member: toPlatformTeamMemberDto(member) }));
    } catch (err: unknown) {
      if (err instanceof PlatformValidation || (err as { code?: string })?.code === "PLATFORM_VALIDATION") {
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "validation_failed", code: "PLATFORM_VALIDATION" }));
        return;
      }
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "method_not_allowed" }));
}
