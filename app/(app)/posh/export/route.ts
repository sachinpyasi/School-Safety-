import { getCurrentUser } from '@/lib/auth/access';
import { recordsFor } from '@/lib/posh';
import { nowIst } from '@/lib/clock';
import { academicYear, buildCards, csvRows, parseAct, parseYear, toCsv } from '@/engine/posh';

export const dynamic = 'force-dynamic';

/** The legacy portal's "⬇ CSV": one Act, one year, every unit, the same columns. Signed-in only
 *  (the middleware already requires it; this re-checks because a route handler is its own door). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Please sign in.', { status: 401 });

  const url = new URL(req.url);
  const today = nowIst();
  const year = parseYear(url.searchParams.get('year'), academicYear(today));
  const act = parseAct(url.searchParams.get('act'));
  const cards = buildCards(await recordsFor(year, act), today);

  // A leading BOM so Excel reads the file as UTF-8 (the legacy export did the same).
  const body = '﻿' + toCsv(csvRows(year, act, cards));
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${act}_${year}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
