#!/bin/sh
set -eu

: "${GRAPH_ADMIN_PASSWORD:?Set GRAPH_ADMIN_PASSWORD}"
: "${GRAPH_APP_PASSWORD:?Set GRAPH_APP_PASSWORD}"

admin_hash=$(printf '%s' "$GRAPH_ADMIN_PASSWORD" | sha256sum | cut -d' ' -f1)
app_hash=$(printf '%s' "$GRAPH_APP_PASSWORD" | sha256sum | cut -d' ' -f1)

umask 077
printf 'user default off\nuser admin on #%s ~* &* +@all\nuser app on #%s ~brainee_dev ~brainee_test_* +@connection +info +graph.query +graph.ro_query\n' \
	"$admin_hash" "$app_hash" > /etc/brainee/users.acl

exec /var/lib/falkordb/bin/run.sh
