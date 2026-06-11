import { NextResponse } from "next/server";

export function bffCodedError(code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: { code } }, { status });
}
