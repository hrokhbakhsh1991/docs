#!/usr/bin/env bash
# Prisma DATABASE_URL values may include query params (e.g. connection_limit) that psql rejects.
psql_database_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse, urlunparse

url = sys.argv[1]
parsed = urlparse(url)
print(urlunparse(parsed._replace(query="", fragment="")))
PY
}
