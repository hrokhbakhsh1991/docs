import { forwardOperatorPassword } from "@/auth/password-bff.server";

export function POST(req: Request) { return forwardOperatorPassword(req, "request-otp"); }
