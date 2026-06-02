import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffDelete, proxyBffGet, proxyBffPatch, proxyBffPost } from "@/lib/api/bff-proxy";

type RouteContext = { params: { userId: string; action: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { userId, action } = context.params;
  if (action !== "role-history") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Unknown users action" } },
      { status: 404 },
    );
  }
  return proxyBffGet(req, `/api/v2/users/${encodeURIComponent(userId)}/role-history`);
}

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { userId, action } = context.params;
  if (action !== "resend-invite") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Unknown users action" } },
      { status: 404 },
    );
  }
  return proxyBffPost(req, `/api/v2/users/${encodeURIComponent(userId)}/resend-invite`);
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { userId, action } = context.params;
  if (action !== "suspend" && action !== "reactivate") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Unknown users action" } },
      { status: 404 },
    );
  }
  return proxyBffPatch(req, `/api/v2/users/${encodeURIComponent(userId)}/${action}`);
}

export async function DELETE(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { userId, action } = context.params;
  if (action !== "remove") {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Unknown users action" } },
      { status: 404 },
    );
  }
  return proxyBffDelete(req, `/api/v2/users/${encodeURIComponent(userId)}/remove`);
}
