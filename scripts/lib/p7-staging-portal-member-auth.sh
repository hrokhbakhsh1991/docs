# P7 staging — portal member OTP + catalog registration helpers.
# Embedded into VPS remote bash via unquoted heredoc; caller must set PTL, PORTAL_HOST, OTP
# before this block (values expand from the probe host).

p7_portal_member_session_token() {
  local phone="$1"
  local display_name="${2:-P7 Portal Member}"
  P7_AUTH_PHONE="${phone}" \
  P7_AUTH_DISPLAY="${display_name}" \
  P7_AUTH_PTL="${PTL}" \
  P7_AUTH_HOST="${PORTAL_HOST}" \
  P7_AUTH_OTP="${OTP}" \
  python3 - <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

ptl = os.environ["P7_AUTH_PTL"]
host = os.environ["P7_AUTH_HOST"]
phone = os.environ["P7_AUTH_PHONE"]
otp = os.environ["P7_AUTH_OTP"]
display = os.environ["P7_AUTH_DISPLAY"]


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{ptl}{path}",
        data=json.dumps(body).encode(),
        headers={"Host": host, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"{path} HTTP {exc.code}: {detail}") from exc


cid = post("/api/public-auth/request-otp", {"phone": phone})["challenge_id"]
verify = post(
    "/api/public-auth/verify-otp",
    {"phone": phone, "otp": otp, "challenge_id": cid},
)
token = verify.get("session_token")
if verify.get("requires_registration"):
    complete = post(
        "/api/public-auth/register-complete",
        {"onboarding_token": verify["onboarding_token"], "display_name": display},
    )
    token = complete.get("session_token")
if not isinstance(token, str) or not token:
    sys.exit("portal member session token missing")
print(token)
PY
}

p7_portal_post_catalog_registration() {
  local tour_id="$1"
  local email="$2"
  local full_name="$3"
  local party_size="$4"
  local member_token="$5"
  local national_id="00$(date +%s | tail -c 8)"
  curl -sf -X POST "${PTL}/api/catalog/registrations" \
    -H "Host: ${PORTAL_HOST}" \
    -H "Content-Type: application/json" \
    -H "Cookie: atour_mb_session=${member_token}" \
    -d "{\"tourId\":\"${tour_id}\",\"email\":\"${email}\",\"fullName\":\"${full_name}\",\"partySize\":${party_size},\"registrantTarget\":\"self\",\"nationalId\":\"${national_id}\",\"fatherName\":\"P7 Probe Father\",\"birthDate\":\"1990-01-15\"}"
}
