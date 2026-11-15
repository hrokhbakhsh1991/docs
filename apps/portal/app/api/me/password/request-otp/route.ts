import { forwardMemberPassword } from "@/auth/password-bff.server";

export function POST(req: Request) { return forwardMemberPassword(req, "request-otp"); }
