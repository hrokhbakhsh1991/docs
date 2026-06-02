import "dotenv/config";

import { resolveTourOpsApiBaseUrl } from "../lib/tour-ops-api-origin";
import { API } from "../lib/api-paths";

async function main() {
  const origin = resolveTourOpsApiBaseUrl();
  if (!origin) {
    process.exit(1);
  }
  const tenantRoot = process.env.TENANT_ROOT_DOMAIN?.trim() || "localhost";
  const slug = process.env.AUTH_LOGIN_SUBDOMAIN?.trim() || "demo";
  const hostHeader =
    tenantRoot === "localhost" ? `${slug}.localhost:3001` : `${slug}.${tenantRoot}`;

  const res = await fetch(`${origin}${API.auth.webSession}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: hostHeader },
    body: JSON.stringify({
      phone: "+989121000001",
      otp: "1234"
    })
  });

  void (await res.json());
}

void main();
