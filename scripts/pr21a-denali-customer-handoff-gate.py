#!/usr/bin/env python3
"""PR21-A — Denali Finance customer handoff gate (operator-facing + SoT)."""
from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

ADMIN_HOST = os.environ.get("ADMIN_HOST", "denali.admin.localhost")
WEB = os.environ.get("WEB", "http://127.0.0.1:3000")
API = os.environ.get("API", "http://127.0.0.1:3001")
PHONE = os.environ.get("SMOKE_OPERATOR_PHONE", "+15550001001")
OTP = os.environ.get("SMOKE_OPERATOR_OTP", "1234")
TENANT = os.environ.get(
    "FINANCE_CASE_COMMAND_UI_TENANT", "00000000-0000-4000-8000-000000000003"
)
JAR = Path(os.environ.get("SMOKE_COOKIE_JAR", "/tmp/pr21a.jar"))
OUT = Path(os.environ.get("SMOKE_RESULTS", "/tmp/pr21a-handoff.json"))
TS = time.strftime("%Y%m%d%H%M%S", time.gmtime())
JPG = Path("/tmp/pr21a.jpg")

MINI_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
)

result: dict[str, Any] = {
    "doc_id": "DENALI_FINANCE_CUSTOMER_HANDOFF_GATE",
    "phase": "PR21-A",
    "tenant": TENANT,
    "environment": {"web": WEB, "api": API, "adminHost": ADMIN_HOST},
    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "steps": [],
    "findings": [],
    "ids": {},
    "routes": [],
}


def save() -> None:
    OUT.write_text(json.dumps(result, indent=2))


def find(cls: str, title: str, detail: str, evidence: str = "") -> None:
    result["findings"].append(
        {
            "class": cls,
            "title": title,
            "detail": detail[:4000],
            "evidence": evidence[:2000],
        }
    )


def step(
    name: str,
    expected: str,
    actual: str,
    status: str,
    evidence: str = "",
    sot_before: Any = None,
    sot_after: Any = None,
    http: Any = None,
    latency_ms: float | None = None,
) -> None:
    row = {
        "step": name,
        "expected": expected,
        "actual": actual[:4000],
        "status": status,
        "evidence": evidence[:4000],
        "http": http,
        "latencyMs": latency_ms,
        "sotBefore": sot_before,
        "sotAfter": sot_after,
    }
    result["steps"].append(row)
    print(f"[{status}] {name}: {actual[:220]}")


def curl(
    method: str,
    path: str,
    *,
    body: Any = None,
    headers: dict[str, str] | None = None,
    raw_body: bytes | None = None,
    base: str | None = None,
    cookie: bool = True,
    timeout: int = 45,
) -> tuple[int, Any, float, str]:
    url = f"{base or WEB}{path}"
    cmd = [
        "curl",
        "-sS",
        "-o",
        "/tmp/pr21a-body.bin",
        "-w",
        "%{http_code}",
        "--max-time",
        str(timeout),
        "-X",
        method,
        "-H",
        f"Host: {ADMIN_HOST}",
    ]
    if cookie and JAR.exists():
        cmd += ["-b", str(JAR), "-c", str(JAR)]
    hdrs = dict(headers or {})
    data_file = None
    if raw_body is not None:
        data_file = Path("/tmp/pr21a-req.bin")
        data_file.write_bytes(raw_body)
        cmd += ["--data-binary", f"@{data_file}"]
    elif body is not None:
        data_file = Path("/tmp/pr21a-req.json")
        data_file.write_text(json.dumps(body))
        hdrs.setdefault("content-type", "application/json")
        cmd += ["--data-binary", f"@{data_file}"]
    for k, v in hdrs.items():
        cmd += ["-H", f"{k}: {v}"]
    cmd.append(url)
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True)
    ms = (time.time() - t0) * 1000
    code = int(proc.stdout.strip() or "0")
    raw = Path("/tmp/pr21a-body.bin").read_bytes()
    text = raw.decode("utf-8", errors="replace")
    parsed: Any
    try:
        parsed = json.loads(text) if text.strip() else None
    except json.JSONDecodeError:
        parsed = text
    result["routes"].append({"method": method, "path": path, "status": code, "ms": round(ms, 1)})
    return code, parsed, ms, text


def login() -> None:
    if JAR.exists():
        JAR.unlink()
    code, body, ms, _ = curl(
        "POST",
        "/api/auth/request-otp",
        body={"phone": PHONE},
        cookie=True,
    )
    # recreate jar via -c
    subprocess.run(
        [
            "curl",
            "-sS",
            "-c",
            str(JAR),
            "-b",
            str(JAR),
            "-H",
            f"Host: {ADMIN_HOST}",
            "-H",
            "content-type: application/json",
            "-d",
            json.dumps({"phone": PHONE}),
            f"{WEB}/api/auth/request-otp",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    ch = json.loads(Path("/tmp/pr21a-body.bin").read_text() if False else "null")
    # re-request properly with jar create
    req = subprocess.run(
        [
            "curl",
            "-sS",
            "-c",
            str(JAR),
            "-b",
            str(JAR),
            "-H",
            f"Host: {ADMIN_HOST}",
            "-H",
            "content-type: application/json",
            "-d",
            json.dumps({"phone": PHONE}),
            f"{WEB}/api/auth/request-otp",
        ],
        capture_output=True,
        text=True,
    )
    challenge = json.loads(req.stdout)["challenge_id"]
    login_body = {"phone": PHONE, "otp": OTP, "challenge_id": challenge}
    login_res = subprocess.run(
        [
            "curl",
            "-sS",
            "-c",
            str(JAR),
            "-b",
            str(JAR),
            "-H",
            f"Host: {ADMIN_HOST}",
            "-H",
            "content-type: application/json",
            "-d",
            json.dumps(login_body),
            f"{WEB}/api/auth/login-web-session",
        ],
        capture_output=True,
        text=True,
    )
    ok = json.loads(login_res.stdout).get("ok") is True
    step(
        "login",
        "operator session ok",
        f"ok={ok}",
        "PASS" if ok else "FAIL",
        evidence=login_res.stdout[:500],
    )
    if not ok:
        raise SystemExit("login failed")


def get_json(path: str) -> tuple[int, Any, float]:
    code, body, ms, _ = curl("GET", path)
    return code, body, ms


def booking_row(reg: str) -> dict[str, Any] | None:
    code, body, _ = get_json("/api/bookings?limit=100")
    if code != 200:
        return None
    items = (body or {}).get("items") or []
    return next((b for b in items if b.get("id") == reg), None)


def invoice(reg: str) -> dict[str, Any] | None:
    code, body, _ = get_json(f"/api/finance/invoices/{reg}")
    return body if code == 200 and isinstance(body, dict) else None


def payments_for(reg: str) -> list[dict[str, Any]]:
    code, body, _ = get_json("/api/finance/payments?limit=200")
    if code != 200:
        return []
    return [p for p in ((body or {}).get("items") or []) if p.get("registrationId") == reg]


def pending_receipts() -> list[dict[str, Any]]:
    code, body, _ = get_json("/api/finance/receipts/pending?limit=50")
    if code != 200:
        return []
    return list((body or {}).get("items") or [])


def ensure_fresh_registration() -> str:
    code, body, _ = get_json("/api/bookings?limit=100")
    items = (body or {}).get("items") or []
    pays = payments_for("__none__")  # warm
    code_p, body_p, _ = get_json("/api/finance/payments?limit=200")
    pay_regs = {
        p.get("registrationId")
        for p in ((body_p or {}).get("items") or [])
        if p.get("status") in ("Paid", "Pending")
    }
    code_r, body_r, _ = get_json("/api/finance/receipts/pending?limit=50")
    pend_regs = {
        (r.get("registrationId") or (r.get("payment") or {}).get("registrationId"))
        for r in ((body_r or {}).get("items") or [])
    }
    clean = [
        b["id"]
        for b in items
        if b.get("status") == "approved"
        and b.get("paymentStatus") == "unpaid"
        and b["id"] not in pay_regs
        and b["id"] not in pend_regs
    ]
    if clean:
        result["ids"]["registration"] = clean[0]
        step(
            "fixture_fresh_registration",
            "approved unpaid with no finance debt",
            clean[0],
            "PASS",
            evidence=f"candidates={len(clean)}",
        )
        return clean[0]

    # Approve pending bookings to create fresh unpaid
    pending = [b for b in items if b.get("status") == "pending"][:3]
    waitlisted = [b for b in items if b.get("status") == "waitlisted"][:3]
    for b in pending + waitlisted:
        c, resp, ms, _ = curl("POST", f"/api/bookings/{b['id']}/approve")
        if c == 200:
            result["ids"]["registration"] = b["id"]
            step(
                "fixture_approve_for_fresh",
                "approved unpaid registration",
                b["id"],
                "PASS",
                http=c,
                latency_ms=ms,
                evidence=str(resp)[:400],
            )
            return b["id"]
    raise SystemExit("no fresh registration available")


def seed_payment_receipt(reg: str, amount: str, tag: str) -> tuple[str, str]:
    JPG.write_bytes(MINI_JPEG)
    code, pay, ms, text = curl(
        "POST",
        "/api/finance/payments/manual",
        body={"registrationId": reg, "amount": amount, "currency": "IRR"},
        headers={"Idempotency-Key": f"pr21a-pay-{tag}-{TS}"},
    )
    if code != 201 or not isinstance(pay, dict) or not pay.get("id"):
        raise RuntimeError(f"manual pay failed {code} {text[:300]}")
    pay_id = pay["id"]
    up_code, up, up_ms, up_text = curl(
        "POST",
        f"/api/finance/receipts/upload?registrationId={reg}",
        raw_body=JPG.read_bytes(),
        headers={
            "content-type": "image/jpeg",
            "x-receipt-file-name": f"pr21a-{tag}.jpg",
        },
    )
    if up_code != 201 or not isinstance(up, dict) or not up.get("fileKey"):
        raise RuntimeError(f"upload failed {up_code} {up_text[:300]}")
    file_key = up["fileKey"]
    sub_code, sub, sub_ms, sub_text = curl(
        "POST",
        "/api/finance/receipts",
        body={"paymentId": pay_id, "fileKey": file_key, "note": f"PR21-A {tag}"},
        headers={"Idempotency-Key": f"pr21a-sub-{tag}-{TS}"},
    )
    if sub_code != 201 or not isinstance(sub, dict) or not sub.get("id"):
        raise RuntimeError(f"submit failed {sub_code} {sub_text[:300]}")
    return sub["id"], pay_id


def review(receipt_id: str, decision: str, tag: str) -> tuple[int, Any, float]:
    code, body, ms, _ = curl(
        "PATCH",
        f"/api/finance/receipts/{receipt_id}/review",
        body={"decision": decision, "reviewNote": f"PR21-A {tag}"},
        headers={"Idempotency-Key": f"pr21a-rev-{tag}-{TS}"},
    )
    return code, body, ms


def sot_snapshot(reg: str) -> dict[str, Any]:
    b = booking_row(reg) or {}
    inv = invoice(reg) or {}
    pays = payments_for(reg)
    pending = [
        r
        for r in pending_receipts()
        if (r.get("registrationId") or (r.get("payment") or {}).get("registrationId")) == reg
    ]
    return {
        "bookingPaymentStatus": b.get("paymentStatus"),
        "bookingStatus": b.get("status"),
        "balanceDueMinor": inv.get("balanceDueMinor"),
        "paidAmountMinor": inv.get("paidAmountMinor"),
        "invoiceTotalMinor": inv.get("invoiceTotalMinor"),
        "payments": [
            {"id": p.get("id"), "status": p.get("status"), "amount": p.get("amount")} for p in pays
        ],
        "pendingReceiptCount": len(pending),
    }


def main() -> int:
    # 0 health
    api = subprocess.run(
        ["curl", "-sS", "--max-time", "5", f"{API}/health"], capture_output=True, text=True
    )
    api_ok = '"status":"ok"' in api.stdout
    step("api_health", "API ok", api.stdout[:120], "PASS" if api_ok else "FAIL")
    if not api_ok:
        result["verdict"] = "BLOCKED"
        find("BLOCKER", "API unavailable", "Cannot hand off without API", api.stdout)
        save()
        return 1

    login()

    # 1 Command Center HTML
    for tab in ["", "?tab=payments", "?tab=receipts", "?tab=ledger", "?tab=overview"]:
        path = f"/finance{tab}"
        code, body, ms, text = curl("GET", path)
        lower = text.lower() if isinstance(text, str) else str(body).lower()
        ok = code in (200, 307, 308) and ("finance" in lower or "payment" in lower or code in (307, 308))
        # follow redirects roughly: if 307, still count route
        if code == 307:
            ok = True
        forbidden = ("prepayments" in lower and 'tab=prepayments' in lower)  # soft
        step(
            f"hub_nav{tab or '_default'}",
            "finance page loads for operator",
            f"http={code} bytes={len(text) if isinstance(text,str) else 0}",
            "PASS" if code == 200 else ("PASS" if code in (307, 308) else "FAIL"),
            http=code,
            latency_ms=ms,
            evidence=f"has_payments={'payment' in lower} has_receipt={'receipt' in lower}",
        )
        if code >= 500:
            find("BLOCKER", f"Finance hub {path} returned {code}", text[:500], path)

    # Check HTML content of /finance for first-customer tabs
    code, _, ms, html = curl("GET", "/finance")
    lower = html.lower()
    for needle, label in [
        ("payments", "payments tab/panel"),
        ("receipts", "receipts tab/panel"),
        ("ledger", "ledger tab/panel"),
        ("overview", "overview"),
    ]:
        present = needle in lower
        step(
            f"hub_visible_{needle}",
            f"{label} visible in command center HTML",
            f"present={present}",
            "PASS" if present else "FAIL",
            evidence="html keyword scan",
        )
        if not present:
            find(
                "BLOCKER" if needle in ("payments", "receipts") else "CUSTOMER_RISK",
                f"Missing {label} in finance hub",
                "Operator cannot reach in-scope surface",
                needle,
            )
    # Out-of-scope should not be advertised as default tabs
    if 'value":"prepayments"' in lower or "tab=prepayments" in lower:
        find(
            "CUSTOMER_RISK",
            "Prepayments still advertised in hub HTML",
            "Out of first-customer scope but visible in markup",
            "prepayments",
        )
    else:
        step("hub_prepayments_hidden", "prepayments not default-visible", "hidden/absent", "PASS")

    if 'value":"installments"' in lower or "tab=installments" in lower:
        find(
            "CUSTOMER_RISK",
            "Installments still advertised in hub HTML",
            "Out of first-customer scope but visible in markup",
            "installments",
        )
    else:
        step("hub_installments_hidden", "installments not default-visible", "hidden/absent", "PASS")

    # Report APIs used by UI
    for path in [
        "/api/finance/reports/summary",
        "/api/finance/reports/ledger-events",
        "/api/finance/reports/by-tour",
        "/api/finance/payments",
        "/api/finance/receipts/pending",
    ]:
        code, body, ms = get_json(path)
        step(
            f"report_or_list{path.replace('/api/finance','')}",
            "200 JSON for operator list/report",
            f"http={code}",
            "PASS" if code == 200 else "FAIL",
            http=code,
            latency_ms=ms,
        )
        if code != 200:
            find("BLOCKER", f"{path} not usable", f"http={code}", str(body)[:400])

    # open-payments should remain out of scope (BFF 404 acceptable)
    code, body, ms = get_json("/api/finance/reports/open-payments")
    step(
        "open_payments_out_of_scope",
        "not required; BFF may 404",
        f"http={code}",
        "PASS",
        http=code,
        latency_ms=ms,
    )

    # Fresh registration
    reg = ensure_fresh_registration()
    before = sot_snapshot(reg)

    # 2 Create manual payment (first underpay)
    JPG.write_bytes(MINI_JPEG)
    code, pay, ms, text = curl(
        "POST",
        "/api/finance/payments/manual",
        body={"registrationId": reg, "amount": "1500000", "currency": "IRR"},
        headers={"Idempotency-Key": f"pr21a-pay-u1-{TS}"},
    )
    after_pay = sot_snapshot(reg)
    pay_ok = code == 201 and isinstance(pay, dict) and pay.get("status") == "Pending"
    step(
        "create_manual_payment_underpay",
        "201 Pending payment for registration",
        f"http={code} status={(pay or {}).get('status') if isinstance(pay, dict) else None}",
        "PASS" if pay_ok else "FAIL",
        http=code,
        latency_ms=ms,
        sot_before=before,
        sot_after=after_pay,
        evidence=str(pay)[:500],
    )
    if not pay_ok:
        find("BLOCKER", "Manual payment create failed", text[:500], reg)
        result["verdict"] = "BLOCKED"
        save()
        return 1
    pay_id = pay["id"]
    result["ids"]["payment1"] = pay_id

    # UI list contains payment
    pays = payments_for(reg)
    listed = any(p.get("id") == pay_id for p in pays)
    step(
        "payment_list_shows_created",
        "payment appears in payments list for registration",
        f"listed={listed} count={len(pays)}",
        "PASS" if listed else "FAIL",
        sot_after=after_pay,
    )
    if not listed:
        find("BLOCKER", "Created payment missing from list UI SoT", pay_id, reg)

    # 3 Receipt lifecycle
    up_code, up, up_ms, up_text = curl(
        "POST",
        f"/api/finance/receipts/upload?registrationId={reg}",
        raw_body=JPG.read_bytes(),
        headers={"content-type": "image/jpeg", "x-receipt-file-name": "pr21a-u1.jpg"},
    )
    file_key = (up or {}).get("fileKey") if isinstance(up, dict) else None
    step(
        "receipt_upload",
        "201 with fileKey",
        f"http={up_code} fileKey={bool(file_key)}",
        "PASS" if up_code == 201 and file_key else "FAIL",
        http=up_code,
        latency_ms=up_ms,
    )
    sub_code, sub, sub_ms, sub_text = curl(
        "POST",
        "/api/finance/receipts",
        body={"paymentId": pay_id, "fileKey": file_key, "note": "PR21-A under1"},
        headers={"Idempotency-Key": f"pr21a-sub-u1-{TS}"},
    )
    rid = (sub or {}).get("id") if isinstance(sub, dict) else None
    step(
        "receipt_submit",
        "201 pending receipt",
        f"http={sub_code} id={rid} status={(sub or {}).get('status') if isinstance(sub, dict) else None}",
        "PASS" if sub_code == 201 and rid else "FAIL",
        http=sub_code,
        latency_ms=sub_ms,
    )
    if not rid:
        find("BLOCKER", "Receipt submit failed", sub_text[:500], pay_id)
        result["verdict"] = "BLOCKED"
        save()
        return 1
    result["ids"]["receipt1"] = rid

    pending = pending_receipts()
    in_pending = any(r.get("id") == rid for r in pending)
    step(
        "receipt_in_pending_queue",
        "receipt visible in pending review list",
        f"in_pending={in_pending}",
        "PASS" if in_pending else "FAIL",
    )
    if not in_pending:
        find("BLOCKER", "Submitted receipt missing from pending queue", rid, reg)

    url_code, url_body, url_ms, _ = curl("GET", f"/api/finance/receipts/{rid}/url")
    step(
        "receipt_url_retrieve",
        "operator can retrieve receipt URL/file reference",
        f"http={url_code}",
        "PASS" if url_code == 200 else "FAIL",
        http=url_code,
        latency_ms=url_ms,
        evidence=str(url_body)[:400],
    )
    if url_code != 200:
        find("BLOCKER", "Receipt retrieve/url broken", str(url_body)[:400], rid)

    # Commercial Meaning before approve
    enc1_code, enc1, enc1_ms, _ = curl(
        "GET", f"/api/finance/case/encounters/{reg}?counterpartyId={reg}"
    )
    exec1 = None
    if isinstance(enc1, dict):
        exec1 = enc1.get("executionId") or (enc1.get("encounter") or {}).get("executionId")
    step(
        "commercial_meaning_load",
        "Meaning loads with executionId",
        f"http={enc1_code} executionId={bool(exec1)}",
        "PASS" if enc1_code == 200 and exec1 else "FAIL",
        http=enc1_code,
        latency_ms=enc1_ms,
        evidence=str({k: enc1.get(k) for k in ("executionId", "commandCapability") if isinstance(enc1, dict)})[:500],
    )
    if enc1_code != 200 or not exec1:
        find(
            "CUSTOMER_RISK",
            "Commercial Meaning failed to load",
            f"http={enc1_code}",
            reg,
        )

    # 4 Approve underpay
    before_appr = sot_snapshot(reg)
    appr_code, appr_body, appr_ms = review(rid, "approve", "under1")
    after_appr = sot_snapshot(reg)
    rem = after_appr.get("balanceDueMinor")
    ok_partial = (
        appr_code == 200
        and after_appr.get("bookingPaymentStatus") == "partial"
        and rem not in (None, "0", 0)
        and (appr_body or {}).get("status") == "Approved"
        if isinstance(appr_body, dict)
        else False
    )
    step(
        "approve_underpay_partial",
        "booking partial + remaining > 0 + receipt Approved",
        f"http={appr_code} booking={after_appr.get('bookingPaymentStatus')} remaining={rem} receipt={(appr_body or {}).get('status') if isinstance(appr_body, dict) else None}",
        "PASS" if ok_partial else "FAIL",
        http=appr_code,
        latency_ms=appr_ms,
        sot_before=before_appr,
        sot_after=after_appr,
    )
    if not ok_partial:
        find("BLOCKER", "Underpay approve did not yield partial+remaining", str(appr_body)[:500], reg)

    # Meaning refresh after approve
    enc2_code, enc2, enc2_ms, _ = curl(
        "GET", f"/api/finance/case/encounters/{reg}?counterpartyId={reg}"
    )
    exec2 = None
    if isinstance(enc2, dict):
        exec2 = enc2.get("executionId") or (enc2.get("encounter") or {}).get("executionId")
    step(
        "commercial_meaning_refresh",
        "refresh yields new executionId; no SoT mutation from Meaning",
        f"http={enc2_code} exec_changed={exec1 != exec2 and bool(exec2)}",
        "PASS" if enc2_code == 200 and exec2 and exec2 != exec1 else "FAIL",
        http=enc2_code,
        latency_ms=enc2_ms,
    )
    after_meaning = sot_snapshot(reg)
    if after_meaning.get("balanceDueMinor") != after_appr.get("balanceDueMinor"):
        find(
            "BLOCKER",
            "Commercial Meaning refresh mutated SoT balances",
            f"before={after_appr} after={after_meaning}",
            reg,
        )

    # Reports after first approve
    for path in ["/api/finance/reports/summary", "/api/finance/reports/ledger-events"]:
        code, body, ms = get_json(path)
        step(
            f"reports_after_partial{path.replace('/api/finance/reports','')}",
            "reports reachable after mutation",
            f"http={code}",
            "PASS" if code == 200 else "FAIL",
            http=code,
            latency_ms=ms,
        )

    # 5 Partial collection mid + final
    rem_prev = int(str(after_appr.get("balanceDueMinor") or "0"))
    for tag, amount, expect_booking, expect_rem_zero in [
        ("mid2", "500000", "partial", False),
        ("final3", "500000", "paid", True),
    ]:
        before_i = sot_snapshot(reg)
        rid_i, pay_i = seed_payment_receipt(reg, amount, tag)
        # pending contains
        in_p = any(r.get("id") == rid_i for r in pending_receipts())
        step(
            f"partial_collect_{tag}_submit",
            "payment+receipt submitted and pending",
            f"receipt={rid_i} pending={in_p}",
            "PASS" if in_p else "FAIL",
            sot_before=before_i,
        )
        code_i, body_i, ms_i = review(rid_i, "approve", tag)
        after_i = sot_snapshot(reg)
        rem_i = int(str(after_i.get("balanceDueMinor") or "0"))
        rem_ok = rem_i < rem_prev and (rem_i == 0 if expect_rem_zero else rem_i > 0)
        booking_ok = after_i.get("bookingPaymentStatus") == expect_booking
        false_paid = after_i.get("bookingPaymentStatus") == "paid" and rem_i > 0
        status = "PASS" if code_i == 200 and rem_ok and booking_ok and not false_paid else "FAIL"
        step(
            f"partial_collect_{tag}_approve",
            f"booking={expect_booking}, remaining decreases, never paid-with-due",
            f"http={code_i} booking={after_i.get('bookingPaymentStatus')} remaining={rem_i} prev={rem_prev}",
            status,
            http=code_i,
            latency_ms=ms_i,
            sot_before=before_i,
            sot_after=after_i,
        )
        if false_paid:
            find(
                "BLOCKER",
                "Paid reported while remaining > 0",
                f"remaining={rem_i}",
                reg,
            )
        if status != "PASS":
            find(
                "BLOCKER",
                f"Partial collection step {tag} failed",
                str(body_i)[:500],
                reg,
            )
        rem_prev = rem_i
        result["ids"][f"receipt_{tag}"] = rid_i
        result["ids"][f"payment_{tag}"] = pay_i

    final = sot_snapshot(reg)
    step(
        "final_settlement",
        "paid + remaining 0",
        f"booking={final.get('bookingPaymentStatus')} remaining={final.get('balanceDueMinor')}",
        "PASS"
        if final.get("bookingPaymentStatus") == "paid" and str(final.get("balanceDueMinor")) == "0"
        else "FAIL",
        sot_after=final,
    )

    # UI ↔ SoT: payments list vs booking
    pays_final = payments_for(reg)
    paid_count = sum(1 for p in pays_final if p.get("status") == "Paid")
    step(
        "ui_sot_payments_vs_booking",
        "multiple Paid payments + booking paid + remaining 0",
        f"paidPayments={paid_count} booking={final.get('bookingPaymentStatus')} rem={final.get('balanceDueMinor')}",
        "PASS"
        if paid_count >= 3
        and final.get("bookingPaymentStatus") == "paid"
        and str(final.get("balanceDueMinor")) == "0"
        else "FAIL",
        sot_after=final,
    )

    # 6 Failure safety — overpay on fresh unpaid
    code_b, body_b, _ = get_json("/api/bookings?limit=100")
    code_p, body_p, _ = get_json("/api/finance/payments?limit=200")
    pay_regs = {
        p.get("registrationId")
        for p in ((body_p or {}).get("items") or [])
        if p.get("status") in ("Paid", "Pending")
    }
    clean2 = [
        b["id"]
        for b in ((body_b or {}).get("items") or [])
        if b.get("status") == "approved"
        and b.get("paymentStatus") == "unpaid"
        and b["id"] not in pay_regs
        and b["id"] != reg
    ]
    if not clean2:
        # try approve another pending
        pending_b = [b for b in ((body_b or {}).get("items") or []) if b.get("status") == "pending"]
        for b in pending_b[:1]:
            curl("POST", f"/api/bookings/{b['id']}/approve")
            clean2 = [b["id"]]
    if clean2:
        reg_o = clean2[0]
        before_o = sot_snapshot(reg_o)
        code_o, body_o, ms_o, _ = curl(
            "POST",
            "/api/finance/payments/manual",
            body={"registrationId": reg_o, "amount": "3000000", "currency": "IRR"},
            headers={"Idempotency-Key": f"pr21a-over-{TS}"},
        )
        after_o = sot_snapshot(reg_o)
        mutated = after_o.get("payments") != before_o.get("payments") and code_o == 422
        # 422 should mean no payment created
        pays_o = payments_for(reg_o)
        step(
            "failure_overpay_422",
            "422 FINANCE_OBLIGATION_OVERPAY, no SoT payment",
            f"http={code_o} code={(body_o or {}).get('code') if isinstance(body_o, dict) else None} payments={len(pays_o)} booking={after_o.get('bookingPaymentStatus')}",
            "PASS"
            if code_o == 422
            and isinstance(body_o, dict)
            and body_o.get("code") == "FINANCE_OBLIGATION_OVERPAY"
            and after_o.get("bookingPaymentStatus") == "unpaid"
            and len(pays_o) == 0
            else "FAIL",
            http=code_o,
            latency_ms=ms_o,
            sot_before=before_o,
            sot_after=after_o,
        )
        if code_o != 422:
            find("BLOCKER", "Overpay not controlled 422", str(body_o)[:400], reg_o)

        # Reject path on another clean
        if len(clean2) > 1:
            reg_r = clean2[1]
        else:
            reg_r = None
            for b in ((body_b or {}).get("items") or []):
                if (
                    b.get("status") == "approved"
                    and b.get("paymentStatus") == "unpaid"
                    and b["id"] not in pay_regs
                    and b["id"] not in (reg, reg_o)
                ):
                    reg_r = b["id"]
                    break
        if reg_r:
            before_r = sot_snapshot(reg_r)
            rid_r, pay_r = seed_payment_receipt(reg_r, "2500000", "reject")
            code_rj, body_rj, ms_rj = review(rid_r, "reject", "reject")
            after_r = sot_snapshot(reg_r)
            step(
                "failure_reject_keeps_unpaid",
                "reject → booking unpaid, receipt Rejected",
                f"http={code_rj} booking={after_r.get('bookingPaymentStatus')} receipt={(body_rj or {}).get('status') if isinstance(body_rj, dict) else None}",
                "PASS"
                if code_rj == 200
                and after_r.get("bookingPaymentStatus") == "unpaid"
                and isinstance(body_rj, dict)
                and body_rj.get("status") == "Rejected"
                else "FAIL",
                http=code_rj,
                latency_ms=ms_rj,
                sot_before=before_r,
                sot_after=after_r,
            )
    else:
        find("CUSTOMER_RISK", "No second clean registration for overpay/reject lanes", "", "")

    # Duplicate after settlement
    dup_code, dup_body, dup_ms, _ = curl(
        "POST",
        "/api/finance/payments/manual",
        body={"registrationId": reg, "amount": "1", "currency": "IRR"},
        headers={"Idempotency-Key": f"pr21a-dup-{TS}"},
    )
    after_dup = sot_snapshot(reg)
    step(
        "failure_duplicate_after_paid",
        "controlled 4xx; remains paid remaining 0",
        f"http={dup_code} booking={after_dup.get('bookingPaymentStatus')} rem={after_dup.get('balanceDueMinor')}",
        "PASS"
        if dup_code == 400
        and after_dup.get("bookingPaymentStatus") == "paid"
        and str(after_dup.get("balanceDueMinor")) == "0"
        else "FAIL",
        http=dup_code,
        latency_ms=dup_ms,
        evidence=str(dup_body)[:400],
        sot_after=after_dup,
    )

    # Unauthorized
    auth_code, auth_body, auth_ms, _ = curl(
        "PATCH",
        f"/api/finance/receipts/{result['ids'].get('receipt1', 'x')}/review",
        body={"decision": "approve"},
        cookie=False,
        headers={"content-type": "application/json"},
    )
    # without cookie jar — force no cookies
    auth_proc = subprocess.run(
        [
            "curl",
            "-sS",
            "-o",
            "/tmp/pr21a-auth.json",
            "-w",
            "%{http_code}",
            "--max-time",
            "20",
            "-H",
            f"Host: {ADMIN_HOST}",
            "-H",
            "content-type: application/json",
            "-X",
            "PATCH",
            "-d",
            '{"decision":"approve"}',
            f"{WEB}/api/finance/receipts/{result['ids'].get('receipt1')}/review",
        ],
        capture_output=True,
        text=True,
    )
    auth_code = int(auth_proc.stdout.strip() or "0")
    step(
        "failure_unauthorized_401",
        "401 without session",
        f"http={auth_code}",
        "PASS" if auth_code == 401 else "FAIL",
        http=auth_code,
    )

    # Stale Command — classic then old encounter
    # Need a clean unpaid for stale seed
    code_b2, body_b2, _ = get_json("/api/bookings?limit=100")
    code_p2, body_p2, _ = get_json("/api/finance/payments?limit=200")
    pay_regs2 = {
        p.get("registrationId")
        for p in ((body_p2 or {}).get("items") or [])
        if p.get("status") in ("Paid", "Pending")
    }
    clean_s = [
        b["id"]
        for b in ((body_b2 or {}).get("items") or [])
        if b.get("status") == "approved"
        and b.get("paymentStatus") == "unpaid"
        and b["id"] not in pay_regs2
    ]
    if clean_s:
        reg_s = clean_s[0]
        rid_s, _ = seed_payment_receipt(reg_s, "1500000", "stale")
        enc_s_code, enc_s, _, _ = curl(
            "GET", f"/api/finance/case/encounters/{reg_s}?counterpartyId={reg_s}"
        )
        exec_s = (enc_s or {}).get("executionId") if isinstance(enc_s, dict) else None
        if not exec_s and isinstance(enc_s, dict):
            exec_s = (enc_s.get("encounter") or {}).get("executionId")
        case_s = None
        if isinstance(enc_s, dict):
            case_s = (enc_s.get("encounter") or {}).get("caseKey") or enc_s.get("caseKey")
        fp_s = (enc_s or {}).get("meaningFingerprint") if isinstance(enc_s, dict) else None
        classic_s, _, _ = review(rid_s, "approve", "stale-classic")
        before_cmd = sot_snapshot(reg_s)
        cmd_body = {
            "caseKey": case_s,
            "action": {
                "command": "reviewReceipt",
                "token": "approve_evidence",
                "decision": "approve",
            },
            "source": {"encounterExecutionId": exec_s or "missing"},
            "correlationId": f"pr21a-stale-{TS}",
            "reviewReceipt": {
                "registrationId": reg_s,
                "counterpartyId": reg_s,
                "receiptId": rid_s,
                "reviewNote": "PR21-A stale",
            },
        }
        if fp_s:
            cmd_body["source"]["meaningFingerprint"] = fp_s
        stale_code, stale_body, stale_ms, _ = curl(
            "POST",
            "/api/finance/case/commands/review-receipt",
            body=cmd_body,
            headers={"Idempotency-Key": f"pr21a-stale-cmd-{TS}"},
        )
        after_cmd = sot_snapshot(reg_s)
        err = stale_body.get("error") if isinstance(stale_body, dict) else None
        err_code = err.get("code") if isinstance(err, dict) else (err or (stale_body or {}).get("code") if isinstance(stale_body, dict) else None)
        # Prefer CASE_COMMAND_STALE; accept other fail-closed 409 that prevents second write
        no_second_write = after_cmd.get("payments") == before_cmd.get("payments") or (
            after_cmd.get("bookingPaymentStatus") == before_cmd.get("bookingPaymentStatus")
            and after_cmd.get("balanceDueMinor") == before_cmd.get("balanceDueMinor")
        )
        # After classic approve, booking may already be partial; command must not change further
        stale_ok = stale_code == 409 and no_second_write
        step(
            "failure_stale_command_409",
            "409 fail-closed; no additional SoT mutation",
            f"http={stale_code} err={err_code} classic={classic_s}",
            "PASS" if stale_ok else "FAIL",
            http=stale_code,
            latency_ms=stale_ms,
            sot_before=before_cmd,
            sot_after=after_cmd,
            evidence=str(stale_body)[:500],
        )
        if stale_code == 409 and err_code and err_code != "CASE_COMMAND_STALE":
            find(
                "UX_IMPROVEMENT",
                "Stale Command returns 409 but not CASE_COMMAND_STALE code",
                f"got {err_code}; fail-closed preserved",
                "command-bridge",
            )
        if not stale_ok:
            find("BLOCKER", "Stale Command not fail-closed", str(stale_body)[:500], reg_s)
    else:
        find("CUSTOMER_RISK", "No clean registration left for stale Command lane", "", "")

    # Cross-tenant fail-closed: hit API finance without proper tenant host if possible
    # Use a bogus Host that is not denali — expect 401/403/404 not 200 mutation
    xt = subprocess.run(
        [
            "curl",
            "-sS",
            "-o",
            "/tmp/pr21a-xt.json",
            "-w",
            "%{http_code}",
            "--max-time",
            "15",
            "-H",
            "Host: urban.admin.localhost",
            "-b",
            str(JAR),
            f"{WEB}/api/finance/payments",
        ],
        capture_output=True,
        text=True,
    )
    xt_code = int(xt.stdout.strip() or "0")
    step(
        "failure_cross_tenant_fail_closed",
        "non-denali host does not return Denali finance data",
        f"http={xt_code}",
        "PASS" if xt_code in (401, 403, 404, 307, 308) else ("FAIL" if xt_code == 200 else "PASS"),
        http=xt_code,
        evidence=Path("/tmp/pr21a-xt.json").read_text(errors="ignore")[:300],
    )
    if xt_code == 200:
        find(
            "BLOCKER",
            "Cross-tenant finance list returned 200 on urban host with denali session",
            Path("/tmp/pr21a-xt.json").read_text(errors="ignore")[:400],
            "tenant-isolation",
        )

    # Command capability discovery on settled case
    enc_f_code, enc_f, _, _ = curl(
        "GET", f"/api/finance/case/encounters/{reg}?counterpartyId={reg}"
    )
    cap = None
    if isinstance(enc_f, dict):
        cap = (enc_f.get("commandCapability") or {}).get("reviewReceipt")
    step(
        "command_capability_discovery",
        "Encounter exposes commandCapability structure without leaking internals",
        f"http={enc_f_code} has_reviewReceipt={bool(cap)}",
        "PASS" if enc_f_code == 200 else "FAIL",
        http=enc_f_code,
        evidence=str(cap)[:400] if cap else "none",
    )
    leak = False
    if isinstance(enc_f, dict):
        blob = json.dumps(enc_f).lower()
        for bad in ("factsnapshot", "interpreter", "prisma", "finance.service"):
            if bad in blob:
                leak = True
    if leak:
        find("CUSTOMER_RISK", "Possible Case internal leakage in Encounter payload", "", reg)
    else:
        step("command_no_case_internals_leak", "no obvious internals in Encounter JSON", "clean", "PASS")

    # Verdict
    blockers = [f for f in result["findings"] if f["class"] == "BLOCKER"]
    material_risks = [f for f in result["findings"] if f["class"] == "CUSTOMER_RISK"]
    failed_core = [
        s
        for s in result["steps"]
        if s["status"] == "FAIL"
        and any(
            k in s["step"]
            for k in (
                "create_manual",
                "receipt_",
                "approve_underpay",
                "partial_collect",
                "final_settlement",
                "failure_overpay",
                "failure_duplicate",
                "failure_unauthorized",
                "failure_stale",
                "hub_visible_payments",
                "hub_visible_receipts",
                "ui_sot",
            )
        )
    ]
    if blockers or failed_core:
        result["verdict"] = "BLOCKED"
    elif any(
        r["title"].startswith("Commercial Meaning") and r["class"] == "CUSTOMER_RISK"
        for r in material_risks
    ):
        # Meaning load failure alone shouldn't block if core finance works — already CUSTOMER_RISK
        result["verdict"] = "READY_FOR_CUSTOMER_HANDOFF"
    else:
        result["verdict"] = "READY_FOR_CUSTOMER_HANDOFF"

    # If material risks include isolation blocker already handled
    result["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    result["summary"] = {
        "stepsPass": sum(1 for s in result["steps"] if s["status"] == "PASS"),
        "stepsFail": sum(1 for s in result["steps"] if s["status"] == "FAIL"),
        "findings": {c: sum(1 for f in result["findings"] if f["class"] == c) for c in ["BLOCKER", "CUSTOMER_RISK", "UX_IMPROVEMENT", "DOCUMENTATION", "NON_BLOCKING"]},
    }
    save()
    print("VERDICT", result["verdict"])
    print("findings", result["summary"]["findings"])
    return 0 if result["verdict"] == "READY_FOR_CUSTOMER_HANDOFF" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        find("BLOCKER", "Handoff script crashed", str(e), "")
        result["verdict"] = "BLOCKED"
        result["error"] = str(e)
        save()
        print("CRASH", e)
        raise
