#!/usr/bin/env bash
# Ensure Node 24 (the version this repo requires) wins in every shell.
#
# The Cloud Agent base image prepends `/exec-daemon` (a Node 22 shim) to PATH
# ahead of nvm's bin dir, so even a login shell resolves Node 22. We fix this by
# symlinking the nvm-installed Node 24 toolchain into the first PATH entry
# (`/usr/local/cargo/bin`), which precedes `/exec-daemon`. Idempotent.
set -eu

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

# Locate an installed Node 24 toolchain (install it via nvm if missing).
node24_bin=""
if [ -d "$NVM_DIR/versions/node" ]; then
  node24_bin="$(ls -d "$NVM_DIR"/versions/node/v24*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$node24_bin" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 24 >/dev/null 2>&1 || true
  nvm alias default 24 >/dev/null 2>&1 || true
  node24_bin="$(ls -d "$NVM_DIR"/versions/node/v24*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi

if [ -z "$node24_bin" ]; then
  echo "ensure-node24: could not locate a Node 24 toolchain under $NVM_DIR" >&2
  exit 1
fi

# Pick the first writable PATH dir that sits ahead of /exec-daemon.
target_dir=""
for d in /usr/local/cargo/bin /usr/local/bin; do
  if [ -d "$d" ] && [ -w "$d" ]; then target_dir="$d"; break; fi
done
if [ -z "$target_dir" ]; then
  target_dir="/usr/local/cargo/bin"
  sudo mkdir -p "$target_dir" 2>/dev/null || true
fi

for bin in node npm npx corepack; do
  if [ -x "$node24_bin/$bin" ]; then
    ln -sf "$node24_bin/$bin" "$target_dir/$bin" 2>/dev/null \
      || sudo ln -sf "$node24_bin/$bin" "$target_dir/$bin" 2>/dev/null || true
  fi
done

corepack enable >/dev/null 2>&1 || true

echo "ensure-node24: linked $("$target_dir/node" -v) from $node24_bin into $target_dir"
