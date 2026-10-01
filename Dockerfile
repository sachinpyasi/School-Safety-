# school-safety — production image.
#
# Portable: any platform that builds a Dockerfile (Railway / Render / Fly / Cloud Run) uses this
# as-is. Single stage on purpose: keep devDependencies so the SAME image runs `prisma migrate deploy`
# (the Prisma CLI) and `next start`. Optimised for "easy to operate".
#
# NO secrets at build time, and that is deliberate: this app carries no private dependency
# (CLAUDE.md §Why no design system), so `npm ci` from the committed lockfile is the whole install and the build has nothing
# secret in it.
FROM node:22-bookworm-slim

# openssl: Prisma's query engine needs it at runtime (the slim image lacks it).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Dependencies, from the lockfile, cached across code changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2) Source + build. Every DB-reading route is force-dynamic, so the build never touches the
#    database; the placeholder DATABASE_URL is scoped to THIS layer and only satisfies Prisma
#    client construction.
COPY . .
RUN export DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
  && npx prisma generate \
  && npm run build

ENV NODE_ENV=production
EXPOSE 4900

# On every start: apply pending migrations (idempotent, retried while Neon wakes up), then serve on
# $PORT (Render sets it) or 4900. The steps and why: scripts/start.sh.
CMD ["sh", "scripts/start.sh"]
