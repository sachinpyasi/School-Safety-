#!/bin/sh
# How the app starts on Render (the Dockerfile's CMD). Two steps:
#   1. `prisma migrate deploy`: bring the database's tables up to date. Safe to run every time.
#      Neon's free database sleeps when nobody uses it and can take a few seconds to wake, so a
#      failed attempt is retried twice before giving up.
#   2. Start the web server on Render's $PORT (4900 when there is none).
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Paste Neon's connection string into Render -> Environment." >&2
  exit 1
fi
case "$DATABASE_URL" in
  *-pooler.*)
    echo "WARNING: DATABASE_URL is Neon's POOLED address (-pooler). Turn connection pooling OFF in" >&2
    echo "Neon -> Connect and paste that string instead: database updates need a direct connection." >&2
    ;;
esac

tries=0
until npx prisma migrate deploy; do
  tries=$((tries + 1))
  if [ "$tries" -ge 3 ]; then
    echo "The database did not answer after 3 tries. Check DATABASE_URL in Render -> Environment." >&2
    exit 1
  fi
  echo "Database not ready yet, trying again in 5 seconds…" >&2
  sleep 5
done

exec npx next start -H 0.0.0.0 -p "${PORT:-4900}"
