#!/usr/bin/env python3
"""Staging tour buy/reserve flow audit — HTTP via VPS IP + Host headers."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

VPS = "89.42.210.252"
PORTS = {"api": 23001, "web": 23000, "mkt": 23002, "ptl": 23003}
OTP = "1234"
OPERATOR_TENANT = "00000000-0000-4000-8000-000000000014"
DENALI_TENANT = "00000000-0000-4000-8000-000000000003"
OPERATOR_TOUR = "00000000-0000-4000-8000-000000000210"
DENALI_TOUR = "00000000-0000-4000-8000-000000000220"
OPERATOR_PHONE = "09174070937"
MEMBER_PHONE = "+15550001003"

results: list[tuple[str, str, str]] = []


def log(flow: str, status: str, detail: str = "") -> None:
    results.append((flow, status, detail))
    mark = {"PASS": "✓", "FAIL": "✗", "SKIP": "○", "WARN": "!"}.get(status, "?")
    line = f"{mark} [{status}] {flow}"
    if detail:
        line += f" — {detail}"
    print(line)


@dataclass
class HttpResult:
    status: int
    body: str
    headers: dict[str, str]


def http(
    port: int,
    path: str,
    host: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    cookie: str | None = None,
    extra_headers: dict[str, str] | None = None,
    follow_redirects: bool = False,
) -> HttpResult:
    url = f"http://{VPS}:{port}{path}"
    headers = {"Host": host, "Accept": "application/json, text/html;q=0.9"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if cookie:
        headers["Cookie"] = cookie
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return HttpResult(resp.status, raw, dict(resp.headers))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return HttpResult(e.code, raw, dict(e.headers))
    except (urllib.error.URLError, ConnectionRefusedError, TimeoutError) as e:
        return HttpResult(0, str(e), {})


def parse_json(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def portal_member_session(host: str, phone: str, full_name: str) -> str | None:
    r1 = http(PORTS["ptl"], "/api/public-auth/request-otp", host, "POST", {"phone": phone})
    if r1.status != 200:
        return None
    cid = parse_json(r1.body).get("challenge_id")
    if not cid:
        return None
    r2 = http(
        PORTS["ptl"],
        "/api/public-auth/verify-otp",
        host,
        "POST",
        {"phone": phone, "otp": OTP, "challenge_id": cid},
    )
    if r2.status != 200:
        return None
    v = parse_json(r2.body)
    token = v.get("session_token")
    if v.get("requires_registration") and v.get("onboarding_token"):
        r3 = http(
            PORTS["ptl"],
            "/api/public-auth/register-complete",
            host,
            "POST",
            {"onboarding_token": v["onboarding_token"], "display_name": full_name},
        )
        if r3.status != 200:
            return None
        token = parse_json(r3.body).get("session_token")
    return token if isinstance(token, str) else None


def operator_session() -> str | None:
    host = "admin.operator.localhost"
    r1 = http(PORTS["web"], "/api/auth/request-otp", host, "POST", {"phone": OPERATOR_PHONE})
    if r1.status != 200:
        return None
    cid = parse_json(r1.body).get("challenge_id")
    if not cid:
        return None
    r2 = http(
        PORTS["web"],
        "/api/auth/login-web-session",
        host,
        "POST",
        {"phone": OPERATOR_PHONE, "otp": OTP, "challenge_id": cid},
    )
    if r2.status != 200:
        return None
    return parse_json(r2.body).get("session_token")


def check_health() -> None:
    for name, port in PORTS.items():
        r = http(port, "/health", "localhost")
        if r.status == 200 and "ok" in r.body.lower():
            log(f"health/{name}", "PASS", f"HTTP {r.status}")
        else:
            log(f"health/{name}", "FAIL", f"HTTP {r.status} {r.body[:120]}")


def check_marketing() -> None:
    cases = [
        ("operator.localhost", OPERATOR_TOUR, "North Ridge Trek"),
        ("denali.club", DENALI_TOUR, None),
    ]
    for host, tour_id, title_hint in cases:
        r = http(PORTS["mkt"], "/tours", host)
        if r.status == 200 and "data-marketing-catalog" in r.body:
            log(f"marketing/browse ({host})", "PASS", "catalog page")
        else:
            log(f"marketing/browse ({host})", "FAIL", f"HTTP {r.status}")
        r2 = http(PORTS["mkt"], f"/tours/{tour_id}", host)
        if r2.status == 200 and "data-marketing-catalog-tour-detail" in r2.body:
            log(f"marketing/tour-detail ({host})", "PASS", tour_id)
        else:
            log(f"marketing/tour-detail ({host})", "FAIL", f"HTTP {r2.status}")
        r3 = http(PORTS["mkt"], "/api/catalog", host)
        if r3.status == 200:
            items = parse_json(r3.body).get("data", {}).get("items", [])
            log(f"marketing/api-catalog ({host})", "PASS", f"{len(items)} tours")
        else:
            log(f"marketing/api-catalog ({host})", "FAIL", f"HTTP {r3.status}")


def check_portal_pages() -> None:
    cases = [
        ("portal.operator.localhost", OPERATOR_TOUR),
        ("portal.denali.club", DENALI_TOUR),
    ]
    for host, tour_id in cases:
        r = http(PORTS["ptl"], f"/catalog/{tour_id}/register", host)
        if r.status == 200:
            log(f"portal/register-page ({host})", "PASS", tour_id)
        elif r.status in (301, 302, 307, 308):
            loc = r.headers.get("Location", r.headers.get("location", ""))
            log(f"portal/register-page ({host})", "PASS", f"redirect {r.status} (auth gate)")
        elif r.status == 0:
            log(f"portal/register-page ({host})", "FAIL", r.body[:120])
        else:
            log(f"portal/register-page ({host})", "FAIL", f"HTTP {r.status}")


def check_registration_anonymous() -> None:
    ts = int(time.time())
    cases = [
        ("portal.operator.localhost", OPERATOR_TOUR, f"audit-op-anon-{ts}@staging.test"),
        ("portal.denali.club", DENALI_TOUR, f"audit-dn-anon-{ts}@staging.test"),
    ]
    for host, tour_id, email in cases:
        r = http(
            PORTS["ptl"],
            "/api/catalog/registrations",
            host,
            "POST",
            {"tourId": tour_id, "email": email, "fullName": "Audit Anon Guest", "partySize": 2},
        )
        j = parse_json(r.body)
        code = j.get("code", "")
        if r.status == 401 and code == "AUTH_UNAUTHENTICATED":
            log(f"portal/register-anon ({host})", "PASS", "expected 401 — member session required")
        elif r.status in (200, 201) and j.get("ok"):
            log(f"portal/register-anon ({host})", "PASS", f"registrationId={j.get('registrationId')}")
        else:
            log(f"portal/register-anon ({host})", "FAIL", f"HTTP {r.status} code={code} {r.body[:160]}")


def check_registration_with_session() -> str | None:
    ts = int(time.time())
    flows = [
        ("portal.denali.club", DENALI_TOUR, f"+1555{ts % 10000000:07d}", f"audit-dn-{ts}@staging.test"),
        ("portal.operator.localhost", OPERATOR_TOUR, f"+1555{ts % 10000000:07d}", f"audit-op-mem-{ts}@staging.test"),
    ]
    last_booking: str | None = None
    for index, (host, tour_id, phone, email) in enumerate(flows):
        token = portal_member_session(host, phone, "Audit Member Guest")
        if not token:
            log(f"portal/otp-login ({host})", "FAIL", f"phone={phone}")
            continue
        log(f"portal/otp-login ({host})", "PASS", phone)
        cookie = f"atour_mb_session={token}"
        national_id = f"00{(ts + index) % 100000000:08d}"
        r = http(
            PORTS["ptl"],
            "/api/catalog/registrations",
            host,
            "POST",
            {
                "tourId": tour_id,
                "email": email,
                "fullName": "Audit Member Guest",
                "partySize": 2,
                "registrantTarget": "self",
                "nationalId": national_id,
                "fatherName": "Audit Father",
                "birthDate": "1990-01-15",
            },
            cookie=cookie,
        )
        j = parse_json(r.body)
        if r.status in (200, 201) and j.get("ok") and j.get("registrationId"):
            rid = j["registrationId"]
            log(f"portal/register-member ({host})", "PASS", f"id={rid}")
            if host == "portal.operator.localhost":
                last_booking = rid
        elif r.status == 409 and j.get("code") == "BOOKING_GUEST_DUPLICATE":
            log(f"portal/register-member ({host})", "WARN", "duplicate guest (idempotent rerun)")
        else:
            log(
                f"portal/register-member ({host})",
                "FAIL",
                f"HTTP {r.status} code={j.get('code')} {r.body[:200]}",
            )
    return last_booking


def check_operator_pending_and_approve(booking_id: str | None) -> None:
    token = operator_session()
    if not token:
        log("operator/otp-login", "FAIL", OPERATOR_PHONE)
        return
    log("operator/otp-login", "PASS", "admin.operator.localhost")
    host = "admin.operator.localhost"
    cookie = f"atour_op_session={token}"
    r = http(
        PORTS["web"],
        f"/api/bookings?tourId={OPERATOR_TOUR}&view=ops",
        host,
        cookie=cookie,
    )
    if r.status != 200:
        log("operator/bookings-list", "FAIL", f"HTTP {r.status}")
        return
    items = parse_json(r.body).get("items", [])
    pending = [x for x in items if x.get("status") == "pending"]
    log("operator/bookings-list", "PASS", f"{len(items)} total, {len(pending)} pending")
    if not booking_id:
        log("operator/approve", "SKIP", "no booking id from member registration")
        return
    r2 = http(PORTS["web"], f"/api/bookings/{booking_id}/approve", host, "POST", cookie=cookie)
    j = parse_json(r2.body)
    if r2.status == 200 and j.get("status") == "approved":
        log("operator/approve", "PASS", booking_id)
    else:
        log("operator/approve", "FAIL", f"HTTP {r2.status} {r.body[:160]}")


def check_dead_routes() -> None:
    host = "admin.operator.localhost"
    routes = [
        f"/tours/{OPERATOR_TOUR}",
        f"/tours/{OPERATOR_TOUR}/bookings",
        f"/tours/{OPERATOR_TOUR}/workspace/bookings",
        "/workspace/registrations",
        "/workspace/bookings",
        "/finance/hub",
        "/finance/receipts",
    ]
    for path in routes:
        r = http(PORTS["web"], path, host)
        if r.status in (301, 302, 307, 308):
            loc = r.headers.get("Location", r.headers.get("location", ""))
            log(f"operator/dead-route {path}", "PASS", f"HTTP {r.status} → {loc[:80]}")
        elif r.status == 500:
            log(f"operator/dead-route {path}", "FAIL", "HTTP 500")
        elif r.status == 200:
            log(f"operator/dead-route {path}", "WARN", "HTTP 200 (page exists, not redirect)")
        else:
            log(f"operator/dead-route {path}", "WARN", f"HTTP {r.status}")


def main() -> int:
    print(f"=== Staging tour buy/reserve audit @ {VPS} ===\n")
    check_health()
    check_marketing()
    check_portal_pages()
    check_registration_anonymous()
    booking_id = check_registration_with_session()
    check_operator_pending_and_approve(booking_id)
    check_dead_routes()

    print("\n=== Summary ===")
    counts = {"PASS": 0, "FAIL": 0, "SKIP": 0, "WARN": 0}
    for _, st, _ in results:
        counts[st] = counts.get(st, 0) + 1
    print(f"PASS={counts['PASS']} FAIL={counts['FAIL']} SKIP={counts['SKIP']} WARN={counts['WARN']}")

    out = "/opt/cursor/artifacts/staging-tour-buy-reserve-audit.txt"
    with open(out, "w") as f:
        f.write(f"Staging audit {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n\n")
        for flow, st, detail in results:
            f.write(f"[{st}] {flow}")
            if detail:
                f.write(f" — {detail}")
            f.write("\n")
        f.write(f"\nPASS={counts['PASS']} FAIL={counts['FAIL']} SKIP={counts['SKIP']} WARN={counts['WARN']}\n")
    print(f"\nWrote {out}")
    return 1 if counts["FAIL"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
