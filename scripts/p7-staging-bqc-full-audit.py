#!/usr/bin/env python3
"""BQC staging full-path HTTP audit — all probe-equivalent checks via VPS IP + Host."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

VPS = "89.42.210.252"
PORTS = {"api": 23001, "web": 23000, "mkt": 23002, "ptl": 23003}
OTP = "1234"
OPERATOR_TENANT = "00000000-0000-4000-8000-000000000014"
DENALI_TENANT = "00000000-0000-4000-8000-000000000003"
OPERATOR_TOUR = "00000000-0000-4000-8000-000000000210"
DRAFT_TOUR = "00000000-0000-4000-8000-000000000211"
DENALI_TOUR = "00000000-0000-4000-8000-000000000220"
OPERATOR_PHONE = "09174070937"
TS = int(time.time())

bugs: list[dict[str, str]] = []
rows: list[tuple[str, str, str]] = []


def log(scenario: str, status: str, detail: str = "") -> None:
    rows.append((scenario, status, detail))
    mark = {"PASS": "✓", "FAIL": "✗", "SKIP": "○", "WARN": "!"}.get(status, "?")
    line = f"{mark} [{status}] {scenario}"
    if detail:
        line += f" — {detail}"
    print(line)
    if status == "FAIL":
        bugs.append({"scenario": scenario, "detail": detail})


@dataclass
class HttpResult:
    status: int
    body: str
    headers: dict[str, str]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http(
    port: int,
    path: str,
    host: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    cookie: str | None = None,
) -> HttpResult:
    url = f"http://{VPS}:{port}{path}"
    headers = {"Host": host, "Accept": "application/json, text/html;q=0.9,*/*;q=0.8"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if cookie:
        headers["Cookie"] = cookie
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=45) as resp:
            return HttpResult(resp.status, resp.read().decode("utf-8", errors="replace"), dict(resp.headers))
    except urllib.error.HTTPError as e:
        return HttpResult(e.code, e.read().decode("utf-8", errors="replace"), dict(e.headers))
    except (urllib.error.URLError, OSError) as e:
        return HttpResult(0, str(e), {})


def jload(raw: str) -> dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def portal_member_token(host: str, phone: str, name: str) -> str | None:
    r1 = http(PORTS["ptl"], "/api/public-auth/request-otp", host, "POST", {"phone": phone})
    if r1.status != 200:
        return None
    cid = jload(r1.body).get("challenge_id")
    r2 = http(
        PORTS["ptl"],
        "/api/public-auth/verify-otp",
        host,
        "POST",
        {"phone": phone, "otp": OTP, "challenge_id": cid},
    )
    if r2.status != 200:
        return None
    v = jload(r2.body)
    token = v.get("session_token")
    if v.get("requires_registration"):
        r3 = http(
            PORTS["ptl"],
            "/api/public-auth/register-complete",
            host,
            "POST",
            {"onboarding_token": v["onboarding_token"], "display_name": name},
        )
        if r3.status != 200:
            return None
        token = jload(r3.body).get("session_token")
    return token if isinstance(token, str) else None


def operator_token(admin_host: str) -> str | None:
    r1 = http(PORTS["web"], "/api/auth/request-otp", admin_host, "POST", {"phone": OPERATOR_PHONE})
    if r1.status != 200:
        return None
    cid = jload(r1.body).get("challenge_id")
    r2 = http(
        PORTS["web"],
        "/api/auth/login-web-session",
        admin_host,
        "POST",
        {"phone": OPERATOR_PHONE, "otp": OTP, "challenge_id": cid},
    )
    if r2.status != 200:
        return None
    return jload(r2.body).get("session_token")


def check_infra() -> None:
    for name, port in PORTS.items():
        r = http(port, "/health", "localhost")
        if r.status == 200:
            log(f"I-health/{name}", "PASS", f"HTTP {r.status}")
        else:
            log(f"I-health/{name}", "FAIL", f"HTTP {r.status}")

    for host, tenant in [
        ("operator.localhost", OPERATOR_TENANT),
        ("portal.operator.localhost", OPERATOR_TENANT),
        ("admin.operator.localhost", OPERATOR_TENANT),
        ("denali.club", DENALI_TENANT),
        ("portal.denali.club", DENALI_TENANT),
    ]:
        r = http(PORTS["api"], "/public/tenant-context", host)
        if r.status != 200:
            log(f"I-tenant/{host}", "FAIL", f"HTTP {r.status}")
            continue
        tid = jload(r.body).get("data", {}).get("tenantId")
        if tid == tenant:
            log(f"I-tenant/{host}", "PASS", tenant)
        else:
            log(f"I-tenant/{host}", "FAIL", f"got {tid} want {tenant}")


def check_marketing() -> None:
    for host, tour in [("operator.localhost", OPERATOR_TOUR), ("denali.club", DENALI_TOUR)]:
        r = http(PORTS["mkt"], "/tours", host)
        if r.status == 200 and "data-marketing-catalog" in r.body:
            log(f"M-browse/{host}", "PASS")
        else:
            log(f"M-browse/{host}", "FAIL", f"HTTP {r.status}")
        r2 = http(PORTS["mkt"], f"/tours/{tour}", host)
        ok = r2.status == 200 and "data-marketing-catalog-tour-detail" in r2.body
        log(f"M-pdp/{host}", "PASS" if ok else "FAIL", f"HTTP {r2.status}")
        if ok:
            for marker in ("data-marketing-register", "data-marketing-login-modal"):
                if marker not in r2.body:
                    log(f"M-cta/{host}/{marker}", "WARN", "missing marker")


def check_portal() -> str | None:
    booking_id: str | None = None
    for host, tour in [("portal.operator.localhost", OPERATOR_TOUR), ("portal.denali.club", DENALI_TOUR)]:
        r = http(PORTS["ptl"], f"/catalog/{tour}/register", host)
        if r.status == 200:
            log(f"P-register-page/{host}", "PASS")
        elif r.status in (301, 302, 307, 308):
            log(f"P-register-page/{host}", "PASS", f"redirect {r.status}")
        else:
            log(f"P-register-page/{host}", "FAIL", f"HTTP {r.status}")

        r_anon = http(
            PORTS["ptl"],
            "/api/catalog/registrations",
            host,
            "POST",
            {"tourId": tour, "email": f"anon-{TS}@t.com", "fullName": "Anon", "partySize": 1},
        )
        if r_anon.status == 401 and jload(r_anon.body).get("code") == "AUTH_UNAUTHENTICATED":
            log(f"P-anon-register/{host}", "PASS", "401 expected")
        else:
            log(f"P-anon-register/{host}", "FAIL", f"HTTP {r_anon.status} {r_anon.body[:120]}")

        phone = f"+1555{TS % 10000000:07d}"
        token = portal_member_token(host, phone, f"BQC Guest {TS}")
        if not token:
            log(f"P-otp/{host}", "FAIL", phone)
            continue
        log(f"P-otp/{host}", "PASS", phone)
        nat = f"00{(TS + hash(host)) % 100000000:08d}"[-10:]
        r_reg = http(
            PORTS["ptl"],
            "/api/catalog/registrations",
            host,
            "POST",
            {
                "tourId": tour,
                "email": f"bqc-{TS}-{host.split('.')[0]}@staging.test",
                "fullName": f"BQC Guest {TS}",
                "partySize": 2,
                "registrantTarget": "self",
                "nationalId": nat,
                "fatherName": "BQC Father",
                "birthDate": "1990-01-15",
            },
            cookie=f"atour_mb_session={token}",
        )
        j = jload(r_reg.body)
        if r_reg.status in (200, 201) and j.get("registrationId"):
            log(f"P-register/{host}", "PASS", j["registrationId"])
            if host == "portal.operator.localhost":
                booking_id = j["registrationId"]
        elif r_reg.status == 409:
            log(f"P-register/{host}", "WARN", "BOOKING_GUEST_DUPLICATE")
        else:
            log(f"P-register/{host}", "FAIL", f"HTTP {r_reg.status} {r_reg.body[:160]}")
    return booking_id


def check_operator(booking_id: str | None) -> None:
    admin = "admin.operator.localhost"
    token = operator_token(admin)
    if not token:
        log("O-otp", "FAIL", admin)
        return
    log("O-otp", "PASS")
    cookie = f"atour_op_session={token}"

    r_tours = http(PORTS["web"], "/tours", admin, cookie=cookie)
    if r_tours.status == 200 and ("data-testid" in r_tours.body or "/tours/" in r_tours.body):
        log("O-tours-list", "PASS", f"HTTP {r_tours.status}")
    else:
        log("O-tours-list", "FAIL", f"HTTP {r_tours.status}")

    r_ws = http(PORTS["web"], f"/tours/{OPERATOR_TOUR}/workspace", admin, cookie=cookie)
    if r_ws.status == 200:
        log("O-workspace", "PASS")
        if 'data-testid="operator-tour-workspace-registrations-panel"' not in r_ws.body:
            log("O-workspace/registrations-panel", "WARN", "panel marker missing")
    else:
        log("O-workspace", "FAIL", f"HTTP {r_ws.status}")

    r_wiz = http(PORTS["web"], "/tours/new", admin, cookie=cookie)
    if r_wiz.status == 200 and "data-workspace-wizard" in r_wiz.body:
        log("O-wizard/new", "PASS")
    elif r_wiz.status == 500 or "__next_error__" in r_wiz.body:
        log("O-wizard/new", "FAIL", f"HTTP {r_wiz.status} server error")
    else:
        log("O-wizard/new", "WARN", f"HTTP {r_wiz.status} wizard marker absent")

    r_bk = http(PORTS["web"], f"/api/bookings?tourId={OPERATOR_TOUR}&view=ops", admin, cookie=cookie)
    if r_bk.status == 200:
        n = len(jload(r_bk.body).get("items", []))
        log("O-bookings-api", "PASS", f"{n} items")
    else:
        log("O-bookings-api", "FAIL", f"HTTP {r_bk.status}")

    if booking_id:
        r_ap = http(PORTS["web"], f"/api/bookings/{booking_id}/approve", admin, "POST", cookie=cookie)
        j = jload(r_ap.body)
        if r_ap.status == 200 and j.get("status") == "approved":
            log("O-approve", "PASS", booking_id)
        else:
            log("O-approve", "FAIL", f"HTTP {r_ap.status} {r_ap.body[:120]}")
    else:
        log("O-approve", "SKIP", "no booking from portal register")

    for path in (
        f"/tours/{OPERATOR_TOUR}",
        "/workspace/registrations",
        "/finance/hub",
        "/finance/receipts",
    ):
        r = http(PORTS["web"], path, admin, cookie=cookie)
        if r.status in (301, 302, 307, 308):
            log(f"O-redirect{path}", "PASS", str(r.status))
        elif r.status == 500:
            log(f"O-redirect{path}", "FAIL", "HTTP 500")
        elif r.status == 200:
            log(f"O-redirect{path}", "PASS", "page exists")
        else:
            log(f"O-redirect{path}", "WARN", f"HTTP {r.status}")


def check_vs01() -> None:
    url = f"http://{VPS}:{PORTS['api']}/denali/catalog"
    req = urllib.request.Request(
        url,
        headers={"Host": "operator.localhost", "x-tenant-id": OPERATOR_TENANT},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            cat = json.loads(resp.read().decode())
    except Exception as e:
        log("VS01-catalog", "FAIL", str(e))
        return
    ids = [i.get("id") for i in cat.get("data", {}).get("items", [])]
    if OPERATOR_TOUR in ids:
        log("VS01-published-in-catalog", "PASS", OPERATOR_TOUR)
    else:
        log("VS01-published-in-catalog", "FAIL", f"tour missing ids={ids[:3]}")
    if DRAFT_TOUR in ids:
        log("VS01-draft-hidden", "FAIL", "draft tour visible in catalog")
    else:
        log("VS01-draft-hidden", "PASS")

    r_mkt = http(PORTS["mkt"], "/tours", "operator.localhost")
    if "North Ridge Trek" in r_mkt.body:
        log("VS01-marketing-title", "PASS")
    else:
        log("VS01-marketing-title", "FAIL", "North Ridge Trek missing")


def check_denali_wizard() -> None:
    admin = "admin.denali.localhost"
    token = operator_token(admin)
    if not token:
        log("W-denali-otp", "FAIL", admin)
        return
    log("W-denali-otp", "PASS")
    r = http(PORTS["web"], "/tours/new", admin, cookie=f"atour_op_session={token}")
    if r.status == 200 and "data-workspace-wizard" in r.body:
        log("W-denali-wizard/new", "PASS")
    elif r.status == 500:
        log("W-denali-wizard/new", "FAIL", "HTTP 500")
    else:
        log("W-denali-wizard/new", "WARN", f"HTTP {r.status}")


def check_legacy_host() -> None:
    r = http(
        PORTS["ptl"],
        "/api/catalog/registrations",
        "operator.portal.localhost",
        "POST",
        {"tourId": OPERATOR_TOUR, "email": "x@t.com", "fullName": "X", "partySize": 1},
    )
    if r.status == 308:
        log("P-legacy-host-308", "PASS", r.headers.get("Location", "")[:80])
    elif r.status == 401:
        log("P-legacy-host-308", "WARN", "no 308 but 401 — host may reach canonical")
    else:
        log("P-legacy-host-308", "FAIL", f"HTTP {r.status}")


def main() -> int:
    print(f"=== BQC staging full audit @ {VPS} ts={TS} ===\n")
    check_infra()
    check_marketing()
    booking_id = check_portal()
    check_operator(booking_id)
    check_vs01()
    check_denali_wizard()
    check_legacy_host()

    counts = {"PASS": 0, "FAIL": 0, "SKIP": 0, "WARN": 0}
    for _, st, _ in rows:
        counts[st] = counts.get(st, 0) + 1

    print("\n=== Summary ===")
    print(
        f"PASS={counts['PASS']} FAIL={counts['FAIL']} WARN={counts['WARN']} SKIP={counts['SKIP']}"
    )
    if bugs:
        print("\n=== Bugs ===")
        for i, b in enumerate(bugs, 1):
            print(f"{i}. {b['scenario']}: {b['detail']}")

    out = "/opt/cursor/artifacts/staging-bqc-full-audit.txt"
    with open(out, "w") as f:
        f.write(f"BQC audit {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n\n")
        for sc, st, det in rows:
            f.write(f"[{st}] {sc}")
            if det:
                f.write(f" — {det}")
            f.write("\n")
        f.write(f"\nPASS={counts['PASS']} FAIL={counts['FAIL']} WARN={counts['WARN']} SKIP={counts['SKIP']}\n")
        if bugs:
            f.write("\nBUGS:\n")
            for b in bugs:
                f.write(f"- {b['scenario']}: {b['detail']}\n")
    print(f"\nWrote {out}")
    return 1 if counts["FAIL"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
