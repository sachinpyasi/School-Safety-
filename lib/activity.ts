/**
 * The read side of the audit trail, for /activity. Scope rules are pure (engine/activity.ts); this
 * only runs the queries. Estate-wide by construction: `AuditEvent` carries no campus column
 * (ruling 1 reserves real campus scoping for route-planning). `app/(admin)/activity/page.tsx`
 * enforces the admin/self-view split (ruling 3) — this file only answers the query it is asked.
 */
import { prisma } from '@/lib/db';
import {
  istDayRange,
  MACHINE_ACTIONS,
  SIGN_IN_ACTION,
  buildPresence,
  daysSpanned,
  type ActivityScope,
  type ActivityPresence,
} from '@/engine/activity';

/** In-page row cap — the summary counts (`total`) stay exact past it. */
export const ACTIVITY_ROW_CAP = 500;

export interface ActivityRow {
  id: string;
  actorEmail: string;
  actorName: string;
  action: string;
  subject: string | null;
  detail: unknown;
  at: Date;
}

export interface ActivityPerson {
  actorEmail: string;
  firstSeen: Date | null;
  signIns: number;
  actions: number;
  lastAction: Date | null;
}

export interface ActivityData {
  total: number;
  rows: ActivityRow[];
  people: ActivityPerson[];
  actions: { action: string; n: number }[];
  signedIn: number;
  active: number;
  presence: ActivityPresence;
}

export async function getActivity(scope: ActivityScope): Promise<ActivityData> {
  const range = istDayRange(scope.from, scope.to);
  const inRange = { at: { gte: range.gte, lt: range.lt } };
  // Ruling 3: a forced self-view (`scope.actorExact`) must match EXACTLY, never as a substring —
  // `contains` stays reserved for the admin's own deliberate free-text search box.
  const actorFilter = scope.actor
    ? {
        actorEmail: scope.actorExact
          ? { equals: scope.actor, mode: 'insensitive' as const }
          : { contains: scope.actor, mode: 'insensitive' as const },
      }
    : {};

  // Register spec §2: the register defaults to DECISION rows — sign-ins live in the presence strip
  // — unless the viewer explicitly picked an action (`scope.action` wins outright) or opted sign-ins
  // back in via `?signins=1`.
  const excludedByDefault = scope.withSignIns ? [...MACHINE_ACTIONS] : [...MACHINE_ACTIONS, SIGN_IN_ACTION];
  const humanActionFilter = scope.action ? { action: scope.action } : { action: { notIn: excludedByDefault } };
  const where = { ...inRange, ...actorFilter, ...humanActionFilter };

  const [rows, total, signIns, signInTimes, acted, byAction] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: ACTIVITY_ROW_CAP,
      select: { id: true, actorEmail: true, actorName: true, action: true, subject: true, detail: true, at: true },
    }),
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.groupBy({
      by: ['actorEmail'],
      where: { ...inRange, ...actorFilter, action: SIGN_IN_ACTION },
      _count: { _all: true },
      _min: { at: true },
    }),
    // Presence strip — the timestamp column ONLY. Sign-ins are throttled to one row per person
    // per SIGN_IN_WINDOW_MS, so even a 30-day range is a few thousand rows at most.
    prisma.auditEvent.findMany({
      where: { ...inRange, ...actorFilter, action: SIGN_IN_ACTION },
      select: { at: true },
    }),
    prisma.auditEvent.groupBy({
      by: ['actorEmail'],
      where: { ...inRange, ...actorFilter, action: { notIn: [SIGN_IN_ACTION, ...MACHINE_ACTIONS] } },
      _count: { _all: true },
      _max: { at: true },
    }),
    prisma.auditEvent.groupBy({
      by: ['action'],
      where: { ...inRange, ...actorFilter },
      _count: { _all: true },
    }),
  ]);

  const people = new Map<string, ActivityPerson>();
  const at = (email: string): ActivityPerson => {
    const key = email.toLowerCase();
    let p = people.get(key);
    if (!p) {
      p = { actorEmail: key, firstSeen: null, signIns: 0, actions: 0, lastAction: null };
      people.set(key, p);
    }
    return p;
  };
  for (const g of signIns) {
    const p = at(g.actorEmail);
    p.signIns += g._count._all;
    const first = g._min.at;
    if (first && (!p.firstSeen || first < p.firstSeen)) p.firstSeen = first;
  }
  for (const g of acted) {
    const p = at(g.actorEmail);
    p.actions += g._count._all;
    const last = g._max.at;
    if (last && (!p.lastAction || last > p.lastAction)) p.lastAction = last;
  }
  const latest = (p: ActivityPerson) => Math.max(p.lastAction?.getTime() ?? 0, p.firstSeen?.getTime() ?? 0);
  const signedIn = new Set(signIns.map((g) => g.actorEmail.toLowerCase())).size;

  return {
    total,
    rows,
    people: [...people.values()].sort((a, b) => latest(b) - latest(a) || a.actorEmail.localeCompare(b.actorEmail)),
    actions: byAction
      .map((g) => ({ action: g.action, n: g._count._all }))
      .sort((a, b) => b.n - a.n || a.action.localeCompare(b.action)),
    signedIn,
    active: new Set(acted.map((g) => g.actorEmail.toLowerCase())).size,
    presence: buildPresence(
      signInTimes.map((r) => r.at),
      signedIn,
      daysSpanned(scope.from, scope.to),
    ),
  };
}
