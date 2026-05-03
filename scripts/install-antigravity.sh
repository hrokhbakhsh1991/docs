#!/usr/bin/env bash
# نصب Google Antigravity (Linux x64) با دانلود رسمی tarball از طریق SOCKS محلی.
# پیش‌نیاز: تونل.DynamicForward روی 127.0.0.1:1080 (مثلاً: ssh -D 1080 -N user@host)
set -euo pipefail

SOCKS="${ANTIGRAVITY_SOCKS:-socks5h://127.0.0.1:1080}"
URL="https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/1.23.2-4781536860569600/linux-x64/Antigravity.tar.gz"
DEST="${HOME}/.local/opt/antigravity"

die() { echo "خطا: $*" >&2; exit 1; }

command -v curl >/dev/null || die "curl نصب نیست."
if ! curl -fsS --connect-timeout 12 --max-time 20 --proxy "${SOCKS}" https://example.com/ -o /dev/null; then
  die "پروکسی SOCKS در دسترس نیست (${SOCKS}). ابتدا ssh -D 1080 را در همین ماشین روشن کن یا ANTIGRAVITY_SOCKS را تنظیم کن."
fi

mkdir -p "${DEST}"
cd "${DEST}"

echo "دانلود از طریق ${SOCKS} ..."
curl -fSL \
  --proxy "${SOCKS}" \
  --retry 25 --retry-delay 8 --retry-all-errors \
  --connect-timeout 60 \
  -C - \
  -o Antigravity.tar.gz \
  "${URL}"

gzip -t Antigravity.tar.gz || die "فایل دانلودشده معتبر نیست؛ دوباره اجرا کن (ادامهٔ دانلود با -C فعال است)."

echo "استخراج ..."
tar -xzf Antigravity.tar.gz

SANDBOX="${DEST}/Antigravity/chrome-sandbox"
if [[ -f "${SANDBOX}" ]] && [[ ! -u "${SANDBOX}" || "$(stat -c '%u' "${SANDBOX}")" != "0" ]]; then
  echo "برای ساندباکس کرومیوم یک بار با sudo اجرا کن:"
  echo "  sudo chown root:root \"${SANDBOX}\" && sudo chmod 4755 \"${SANDBOX}\""
fi

echo
echo "نصب کاربر تکمیل شد: ${DEST}"
echo "فایل‌های اجرایی ممکن است در یک زیرپوشه باشند؛ لیست:"
find "${DEST}" -maxdepth 4 \( -name '*.AppImage' -o -perm -111 -type f \) 2>/dev/null | head -30 || true
