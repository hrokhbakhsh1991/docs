/**
 * k6 login storm — Infrastructure Closure Phase 5 (skeleton).
 *
 * Usage (requires k6 installed):
 *   k6 run scripts/k6/login-storm.js \
 *     -e BASE_URL=https://ws1-rbac.localhost:3000 \
 *     -e PHONE=+989121234567 \
 *     -e OTP=000000
 *
 * Targets: 100+ parallel VUs, P95 < 200ms on BFF auth routes (tune thresholds after baseline).
 */
import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.BASE_URL || "http://ws1-rbac.localhost:3000").replace(/\/$/, "");
const phone = __ENV.PHONE || "";
const otp = __ENV.OTP || __ENV.INFRA_OTP || "1234";

export const options = {
  scenarios: {
    login_storm: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<200"],
  },
};

export default function loginStorm() {
  if (!phone || !otp) {
    sleep(1);
    return;
  }
  const preflight = http.post(
    `${baseUrl}/api/auth/phone-preflight`,
    JSON.stringify({ phone }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(preflight, { "preflight 2xx": (r) => r.status >= 200 && r.status < 300 });

  const otpReq = http.post(
    `${baseUrl}/api/auth/request-otp`,
    JSON.stringify({ phone }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(otpReq, { "request-otp 2xx": (r) => r.status >= 200 && r.status < 300 });

  const login = http.post(
    `${baseUrl}/api/auth/login-web-session`,
    JSON.stringify({ phone, otp }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(login, { "login 2xx": (r) => r.status >= 200 && r.status < 300 });
  sleep(0.5);
}
