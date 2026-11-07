#!/usr/bin/env bash
# Runs migrations + seed + SQL tests against a throwaway local Postgres (no Docker needed).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
[ -z "$PGBIN" ] && PGBIN=$(dirname "$(command -v pg_ctl)")
DATA=$(mktemp -d)
PORT=55432
RUN=()
if [ "$(id -u)" = 0 ]; then RUN=(runuser -u postgres --); chown postgres "$DATA"; fi

"${RUN[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null || true; rm -rf "$DATA"; }
trap cleanup EXIT

PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$DIR/tests/supabase_stub.sql"
for f in "$DIR"/migrations/*.sql; do echo "migrate: $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$DIR/seed.sql"
"${PSQL[@]}" -f "$DIR/tests/test_redemption.sql"
"${PSQL[@]}" -f "$DIR/tests/test_roles_payments.sql"
echo "ALL TESTS PASSED"
