import "dotenv/config";

import { normalizeTourOpsApiOrigin } from "../lib/api-client";
import { API } from "../lib/api-paths";

async function main() {
  const origin = normalizeTourOpsApiOrigin(process.env.NEXT_PUBLIC_API_URL ?? "");
  if (!origin) {
    console.error("NEXT_PUBLIC_API_URL is not set.");
    process.exit(1);
  }
  const res = await fetch(`${origin}${API.auth.webSession}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entry_mode: "web",
      credential: {
        email: "leader@test.com",
        password: "demo123"
      },
      asserted_tenant_id: process.env.NEXT_PUBLIC_TENANT_ID
    })
  });

  const body = await res.json();
  console.log("Status:", res.status);
  console.log(body);
}

main().catch((e) => console.error(e));
