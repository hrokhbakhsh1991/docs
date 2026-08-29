#!/usr/bin/env bash
# Package one Next.js app after ARTIFACT_STANDALONE_BUILD=1 next build.
set -euo pipefail

package_next_standalone() {
  local repo_root="$1"
  local app_rel="$2" # e.g. apps/web
  local out_dir="$3" # e.g. $ARTIFACT_ROOT/web

  local app_dir="${repo_root}/${app_rel}"
  local standalone_root="${app_dir}/.next/standalone"
  local server_js=""

  if [[ -f "${standalone_root}/${app_rel}/server.js" ]]; then
    server_js="${app_rel}/server.js"
  elif [[ -f "${standalone_root}/server.js" ]]; then
    server_js="server.js"
  else
    echo "artifact-standalone: missing server.js under ${standalone_root}" >&2
    find "${standalone_root}" -maxdepth 4 -name 'server.js' 2>/dev/null | head -5 >&2 || true
    return 1
  fi

  rm -rf "$out_dir"
  mkdir -p "$out_dir"
  cp -a "${standalone_root}/." "$out_dir/"
  mkdir -p "${out_dir}/$(dirname "${app_rel}")/${app_rel##*/}/.next"
  cp -a "${app_dir}/.next/static" "${out_dir}/${app_rel}/.next/static"
  if [[ -d "${app_dir}/public" ]]; then
    cp -a "${app_dir}/public" "${out_dir}/${app_rel}/public"
  fi

  cat >"${out_dir}/RUNTIME.json" <<EOF
{"app":"${app_rel}","serverJs":"${server_js}","mode":"next-standalone"}
EOF
  echo "[artifact] packaged ${app_rel} -> ${out_dir} (server=${server_js})"
}
