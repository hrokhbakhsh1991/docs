import { readFileSync, writeFileSync } from "node:fs";

const TOKEN = JSON.parse(
  readFileSync("/opt/cursor/artifacts/dp2-cert-api-login.json", "utf8")
).sessionToken;
const TOUR_ID = "00000000-0000-4000-8000-000000000214";
const BASE = "http://127.0.0.1:3001";
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Host: "denali.admin.localhost",
  "Content-Type": "application/json",
};

async function api(method, path, body, idempotencyKey) {
  const hdrs = { ...headers };
  if (idempotencyKey) hdrs["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: hdrs,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body: json };
}

const log = { tourId: TOUR_ID, members: {} };

async function createApprove(label, extra = {}) {
  const created = await api("POST", "/bookings", {
    tourId: TOUR_ID,
    tourTitle: "Carpool Pass",
    guestLabel: label,
    guestEmail: `${label.replace(/\s+/g, ".").toLowerCase()}@dp2-cert.local`,
    guestPhone: "+15550009999",
    partySize: 1,
    departureAt: "2031-09-01T10:00:00.000Z",
    registrationIntake: { tourCapacityMax: 12, ...extra },
  });
  const id = created.body?.id ?? "";
  const approved = await api("POST", `/bookings/${id}/approve`, {});
  return { id, created, approved };
}

const a = await createApprove("Member A Paid");
const invA = await api("GET", `/finance/registrations/${a.id}/invoice`);
const totalA = invA.body?.invoiceTotalMinor ?? "2500000";
await api("POST", "/finance/payments/manual", {
  registrationId: a.id,
  amount: totalA,
  currency: "IRR",
}, `dp2-cert-pay-a-${a.id}`);
log.members.A = { id: a.id, scenario: "approved+paid" };

const b = await createApprove("Member B Unpaid");
log.members.B = { id: b.id, scenario: "approved+unpaid" };

const c = await createApprove("Member C Partial");
await api("POST", "/finance/payments/manual", {
  registrationId: c.id,
  amount: "1000000",
  currency: "IRR",
}, `dp2-cert-pay-c-${c.id}`);
log.members.C = { id: c.id, scenario: "approved+partial" };

const dCreated = await api("POST", "/bookings", {
  tourId: TOUR_ID,
  tourTitle: "Carpool Pass",
  guestLabel: "Member D Waitlist",
  guestEmail: "member.d@dp2-cert.local",
  partySize: 1,
  departureAt: "2031-09-01T10:00:00.000Z",
  registrationIntake: { tourCapacityMax: 12 },
});
const dId = dCreated.body?.id ?? "";
await api("POST", `/bookings/${dId}/waitlist`, {});
log.members.D = { id: dId, scenario: "waitlisted" };

const e = await createApprove("Member E Driver", {
  transport: { kind: "personal_car", personalCarOccupants: 3 },
});
log.members.E = { id: e.id, scenario: "driver+3-seats" };

log.roster = {};
for (const filter of ["operational", "final", "unpaid", "paid", "expiring", "waitlist"]) {
  log.roster[filter] = await api(
    "GET",
    `/tours/${TOUR_ID}/operational-roster?filter=${filter}&view=ops&limit=50`
  );
}

writeFileSync("/opt/cursor/artifacts/dp2-cert-api-roster-responses.json", JSON.stringify(log, null, 2));
console.log(JSON.stringify(log.members, null, 2));
