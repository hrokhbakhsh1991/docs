import { forwardMemberPassword } from "@/auth/password-bff.server";

export function GET(req: Request) { return forwardMemberPassword(req, "status"); }
export function POST(req: Request) { return forwardMemberPassword(req, "set"); }
