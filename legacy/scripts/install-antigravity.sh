#!/usr/bin/env bash
# نصب Antigravity IDE (Linux x64) — آخرین tarball رسمی CDN + میانبر دسکتاپ
set -euo pipefail

URL="${ANTIGRAVITY_URL:-https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/1.23.2-4781536860569600/linux-x64/Antigravity.tar.gz}"
DEST="${HOME}/.local/opt/antigravity"
BIN="${HOME}/.local/bin/antigravity"
DESKTOP="${HOME}/.local/share/applications/antigravity.desktop"
APP_DIR="${DEST}/Antigravity"
EXEC="${APP_DIR}/antigravity"
ICON="${APP_DIR}/resources/app/out/vs/platform/browserOnboarding/static/antigravity.svg"
SANDBOX="${APP_DIR}/chrome-sandbox"
SOCKS="${ANTIGRAVITY_SOCKS:-}"

die() { echo "خطا: $*" >&2; exit 1; }

command -v curl >/dev/null || die "curl نصب نیست."

curl_download() {
  local out="$1" url="$2"
  if [[ -n "${SOCKS}" ]] && curl -fsS --connect-timeout 12 --max-time 20 --proxy "${SOCKS}" https://example.com/ -o /dev/null 2>/dev/null; then
    echo "دانلود از طریق SOCKS (${SOCKS}) ..."
    curl -fSL --proxy "${SOCKS}" --retry 10 --retry-delay 5 --connect-timeout 60 -C - -o "${out}" "${url}"
  else
    echo "دانلود مستقیم ..."
    curl -fSL --retry 10 --retry-delay 5 --connect-timeout 60 -C - -o "${out}" "${url}"
  fi
}

mkdir -p "${DEST}" "${HOME}/.local/bin" "${HOME}/.local/share/applications"
cd "${DEST}"

if [[ ! -f Antigravity.tar.gz ]]; then
  curl_download Antigravity.tar.gz "${URL}"
fi
gzip -t Antigravity.tar.gz || die "فایل دانلودشده معتبر نیست."

echo "استخراج ..."
rm -rf Antigravity
tar -xzf Antigravity.tar.gz
[[ -x "${EXEC}" ]] || die "فایل اجرایی پیدا نشد: ${EXEC}"

# ساندباکس کرومیوم (برای اجرای پایدار IDE)
if [[ -f "${SANDBOX}" ]]; then
  if [[ ! -u "${SANDBOX}" || "$(stat -c '%u' "${SANDBOX}" 2>/dev/null || echo -1)" != "0" ]]; then
    if [[ -n "${SUDO_PASSWORD:-}" ]]; then
      echo "${SUDO_PASSWORD}" | sudo -S chown root:root "${SANDBOX}"
      echo "${SUDO_PASSWORD}" | sudo -S chmod 4755 "${SANDBOX}"
    else
      echo "برای ساندباکس: sudo chown root:root \"${SANDBOX}\" && sudo chmod 4755 \"${SANDBOX}\""
    fi
  fi
fi

cat > "${BIN}" <<EOF
#!/usr/bin/env sh
exec "${EXEC}" --ozone-platform=x11 "\$@"
EOF
chmod +x "${BIN}"

cat > "${DESKTOP}" <<EOF
[Desktop Entry]
Name=Antigravity
Comment=Google Antigravity IDE
Exec=${BIN} %F
Terminal=false
Type=Application
Icon=${ICON}
StartupWMClass=Antigravity
Categories=Development;IDE;
MimeType=x-scheme-handler/antigravity;text/plain;text/html;
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
fi

echo
echo "نصب تکمیل شد."
echo "  اجرا: ${BIN}"
echo "  نسخه: $("${BIN}" --version 2>/dev/null || true)"
