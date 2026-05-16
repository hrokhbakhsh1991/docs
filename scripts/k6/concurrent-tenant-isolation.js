/**
 * Concurrent tenant isolation — Phase 5.
 *
 * Each tenant logs in on its own host, lists tours via BFF, then probes a foreign host
 * with the same cookie jar (must fail closed: 401/403, never 200 with foreign data).
 *
 *   k6 run scripts/k6/concurrent-tenant-isolation.js \
 *     -e OTP=1234 \
 *     -e WS1_PHONE=+15550000001 \
 *     -e WS2_PHONE=+15550000002 \
 *     -e WS3_PHONE=+15550000003
 */
import http from "k6/http";
import { check, sleep } from "k6";

const OTP = __ENV.OTP || "1234";
const WEB_PORT = __ENV.WEB_PORT || "3000";

const TENANTS = [
  { slug: "ws1-rbac", phone: __ENV.WS1_PHONE || "" },
  { slug: "ws2-rbac", phone: __ENV.WS2_PHONE || "" },
  { slug: "ws3-rbac", phone: __ENV.WS3_PHONE || "" },
];

function webOrigin(slug) {
  return `http://${slug}.localhost:${WEB_PORT}`;
}

function loginOnHost(slug, phone) {
  const base = webOrigin(slug);
  const jar = http.cookieJar();
  const headers = { "Content-Type": "application/json" };

  const pre = http.post(`${base}/api/auth/phone-preflight`, JSON.stringify({ phone }), {
    headers,
    jar,
  });
  if (pre.status < 200 || pre.status >= 300) {
    return { jar, ok: false, step: "preflight" };
  }

  const otpReq = http.post(`${base}/api/auth/request-otp`, JSON.stringify({ phone }), {
    headers,
    jar,
  });
  if (otpReq.status < 200 || otpReq.status >= 300) {
    return { jar, ok: false, step: "request-otp" };
  }

  const login = http.post(
    `${base}/api/auth/login-web-session`,
    JSON.stringify({ phone, otp: OTP }),
    { headers, jar },
  );
  if (login.status < 200 || login.status >= 300) {
    return { jar, ok: false, step: "login" };
  }

  return { jar, ok: true, step: "ok" };
}

export const options = {
  scenarios: {
    tenant_isolation: {
      executor: "per-vu-iterations",
      vus: TENANTS.length,
      iterations: 1,
      maxDuration: "3m",
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
  },
};

export default function tenantIsolationProbe() {
  const tenant = TENANTS[(__VU - 1) % TENANTS.length];
  if (!tenant.phone) {
    console.warn(`Set WS${__VU}_PHONE for tenant ${tenant.slug}`);
    sleep(1);
    return;
  }

  const home = loginOnHost(tenant.slug, tenant.phone);
  check(home, {
    "login ok": (r) => r.ok === true,
  });
  if (!home.ok) {
    return;
  }

  const listRes = http.get(`${webOrigin(tenant.slug)}/api/tours?limit=5`, {
    jar: home.jar,
  });
  check(listRes, {
    "home tours 2xx": (r) => r.status >= 200 && r.status < 300,
  });

  const foreign = TENANTS.find((t) => t.slug !== tenant.slug);
  if (foreign) {
    const cross = http.get(`${webOrigin(foreign.slug)}/api/tours?limit=5`, {
      jar: home.jar,
    });
    check(cross, {
      "foreign host blocked": (r) => r.status === 401 || r.status === 403,
    });
  }

  sleep(0.2);
}
