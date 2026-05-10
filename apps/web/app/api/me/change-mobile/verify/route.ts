import { proxyMePost } from "@/lib/me-bff";

export async function POST(req: Request) {
  return proxyMePost(req, "/change-mobile/verify");
}
