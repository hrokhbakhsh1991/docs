import "dotenv/config";

import { resolveTourOpsApiBaseUrl } from "../lib/tour-ops-api-origin";
import { API } from "../lib/api-paths";

async function main() {
  const origin = resolveTourOpsApiBaseUrl();
  if (!origin) {
    console.error(
      "API origin is empty: set NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true and NEXT_PUBLIC_TENANT_ROOT_DOMAIN (Node has no browser host)."
    );
    process.exit(1);
  }
  const tenantRoot = process.env.TENANT_ROOT_DOMAIN?.trim() || "localhost";
  const slug = process.env.AUTH_LOGIN_SUBDOMAIN?.trim() || "demo";
  const hostHeader =
    tenantRoot === "localhost" ? `${slug}.localhost` : `${slug}.${tenantRoot}`;

  const res = await fetch(`${origin}${API.auth.webSession}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: hostHeader },
    body: JSON.stringify({
      phone: "+15551234567",
      otp: "1234"
    })
  });

  const body = await res.json();
  console.log("Status:", res.status);
  console.log(body);
}

main().catch((e) => console.error(e));
