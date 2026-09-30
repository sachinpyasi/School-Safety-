import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * The container liveness probe. Public (lib/auth/public-routes.ts) because it must answer before
 * any auth source is configured — a gated health check leaves the deploy never going live.
 * Reports whether the database answers; nothing about people, nothing about records.
 */
export async function GET() {
  let db: 'ok' | 'down' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }
  return Response.json(
    { ok: db === 'ok', db, at: new Date().toISOString() },
    { status: db === 'ok' ? 200 : 503 },
  );
}
