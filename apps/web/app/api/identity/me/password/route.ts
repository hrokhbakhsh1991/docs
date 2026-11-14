import { forwardOperatorPassword } from "@/auth/password-bff.server";

export function GET(req: Request) { return forwardOperatorPassword(req, "status"); }
export function POST(req: Request) { return forwardOperatorPassword(req, "set"); }
