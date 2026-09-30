// lib/auth/org-domains.ts — WHICH email domains belong to the Fountainhead Google org, and
// WHO inside them is staff.
//
// ============================================================================================
// COPIED from the Nucleus prototypes estate (vardan-kabra/nucleus-prototypes) on 30-Sep-2026 and
// NO LONGER SYNCED with it. In this repo this file is the only copy and the source of truth for
// which school email domains may sign in. The estate's rulings it cites below are kept as the
// reasons behind its behaviour. To change the domain list: edit SEED_ORG_DOMAINS below, or set
// AUTH_ALLOWED_DOMAINS on the host without touching code.
// ============================================================================================
//
// WHAT RULING 13 ACTUALLY SAYS, because two halves of it pull in opposite directions:
//
//   · The ten-domain list is NEVER narrowed per app. VK was offered "cut each app's list to the
//     domains whose staff use it" and rejected it: protego.services accounts are staff with real
//     work to do, and access is "everyone within the Fountainhead Google organization space".
//   · Apps should READ the org's domain list from the Google Workspace Admin API, cached, so a
//     new campus domain works the day it is created — rather than waiting for somebody to notice
//     and sweep ten files.
//
// And the constraint that outranks both (B1, and the reason this ships dark):
//
//   · THE SERVICE ACCOUNT DOES NOT EXIST YET. BACKLOG.md has carried "[ibdp] Staff-OU Google
//     service account [awaiting-you]" for weeks. With GOOGLE_SA_KEY / GOOGLE_ADMIN_SUBJECT
//     unset, this module behaves byte-for-byte as the hardcoded lists it replaces did: the seed
//     list, no OU check, nobody newly admitted and — far more important — NOBODY NEWLY LOCKED
//     OUT. An estate that locks itself out of sixteen apps on a missing environment variable is
//     far worse than the problem this solves.
//
// TWO THINGS THIS MODULE IS INCAPABLE OF, both regression-locked in tests:
//   1. Returning an EMPTY list. An empty `domains` array from Google is a FAILURE, not an
//      answer — treating it as an answer would refuse every sign-in in the estate at once.
//   2. Returning "everyone". There is no wildcard, no "empty means allow all", no path where a
//      caller's domain check degrades into an accept-all. `AUTH_ALLOWED_DOMAINS=*` is stripped.
//
// AUTH_ALLOWED_DOMAINS WINS OVER EVERYTHING, always. It is the only lever an operator has
// mid-incident, and ibdp-results, dp-sow-tracker and route-planning already depend on it in
// Railway today. When it is set, no network call is made at all.
//
// --------------------------------------------------------------------------------------------
// EDGE SAFETY IS LOAD-BEARING AND ALREADY PAID FOR.
//
// cafeteria-checkin, campus-displays, event-management, whatsapp-scheduler and route-planning
// import `auth` / `auth.config` from middleware.ts, so this module lands in the EDGE bundle. A
// Node-only import there still BUILDS with exit 0 (Next emits warnings only) and first appears
// as a production outage. Hence: no 'server-only', no Node `Buffer`, no `googleapis`, no
// `node:*` — and NO PACKAGE IMPORTS AT ALL. This file imports nothing.
//
// It also imports nothing for a second, duller reason that is easy to miss: only three of the
// sixteen apps (ibdp-results, dp-sow-tracker, route-planning) declare `jose` in package.json.
// The others get it hoisted from next-auth's transitive tree, and front-desk — which needs this
// module for core/senders.ts — has no next-auth and therefore no jose at all. A byte-identical
// copy cannot depend on a package thirteen apps do not declare, so the RS256 service-account
// assertion is minted with WebCrypto (`crypto.subtle`), which is present in Node ≥18 and in the
// edge runtime alike. Structure, env vars, caching and fail-safe semantics are lifted verbatim
// from ibdp-results/lib/auth/org-directory.ts, which had this working first; only the four lines
// that were `jose`'s `importPKCS8` + `SignJWT` are replaced, and signJwtRS256 is round-tripped
// against a real generated key in the tests.
//
// Nothing here touches Prisma, and the cache is IN MEMORY, per instance, on purpose: sign-in
// must not depend on a database being up, and the edge rules forbid Prisma on this path anyway.
// --------------------------------------------------------------------------------------------

/**
 * The ten domains VK ratified, and STILL the source of truth until the service account lands.
 *
 * This is a SEED, not a cap: once the resolver is configured, the Workspace's own answer
 * replaces it. Ask VK before adding or removing one — he owns this list, and every copy of this
 * file has to move in the same pass (that is what --sync is for).
 *
 * History, kept because each entry was somebody locked out: fsksurat.in added 2026-07-13,
 * fsmsurat.in 2026-07-31 (the Malgama van staff running the route-planning trial),
 * fountainheadpreschools.org 2026-08-07 (found by accident, in the wrong direction — the
 * front-desk copy had it and the canonical list did not).
 */
export const SEED_ORG_DOMAINS: readonly string[] = [
  'fountainheadschools.org',
  'protego.services',
  'fwgs.in',
  'falh.in',
  'fasv.in',
  'fpvesu.in',
  'fpadajan.in',
  'fsksurat.in',
  'fsmsurat.in',
  'fountainheadpreschools.org',
];

/**
 * Domains VK has ruled ARE org staff but which may not appear in the Workspace's own
 * `domains.list` answer — unioned into every resolved list so the API can never drop them.
 *
 * Exactly one entry, and it is the whole reason this constant exists. BUILD-DECISIONS.md's
 * external-setup item 2 asks VK to confirm in Google Admin → Domains whether protego.services
 * sits inside the school's Workspace or is Protego's separate one; ruling 13 has already decided
 * what happens either way — "protego.services accounts are staff with real work to do". So if
 * the answer is "separate Workspace", the resolver going live must not silently offboard the
 * outsourced operator's staff on the day the credential is set.
 *
 * If the answer comes back "same Workspace", this entry becomes a harmless duplicate. Leave it.
 */
export const PARTNER_ORG_DOMAINS: readonly string[] = ['protego.services'];

/**
 * B1's named exceptions: the apps deliberately OPEN TO NON-STAFF members of the org, where the
 * staff-OU gate must not apply.
 *
 * A named export rather than a string comparison scattered across apps, because that comparison
 * is the thing that rots — an app renamed, an app added, a copy-pasted `if (app !== 'cafeteria')`
 * left behind. Everywhere else, staff only: students, parents and alumni hold addresses on
 * exactly the same ten domains as staff, so a domain check alone admits the whole school.
 *
 *   cafeteria-checkin  — parents order food (VK, 28-Aug-2026).
 *   nucleus-parent     — the parent face; staff-only would be the entire point, inverted.
 *   career-counselling — students AND parents are first-class identities here (VK, 05-Sep-2026).
 *   exam-module        — STUDENTS sit their MYP exams here; parents are not admitted (12-Sep-2026).
 *
 * THE NAME UNDERSTATES IT, DELIBERATELY. `career-counselling` admits STUDENTS as well as parents
 * and `exam-module` admits students ONLY, so this list is really "apps open to non-staff", and the
 * last two entries are the ones that say so. VK chose the one-line addition over minting a
 * separate `STUDENT_OPEN_APPS`: a second list would be a new estate-wide concept, and every
 * consumer asks the same single question — does the staff OU gate apply here. Split it the day an
 * app needs students in and parents out, or the reverse. VK owns this list: ask before adding to
 * it — the exam-module entry (12-Sep-2026) was added on the strength of the review-prep finding
 * and VK ratified it by merging #1301 the same day.
 *
 * exam-module WAS THE SAME SHAPE, found 12-Sep-2026 during the MYP review prep. Its
 * `lib/auth/roles.ts` resolves a rostered school email to role 'student' — every MYP student at
 * FSK and FWGS reaches /sit through "Continue with Google" on the same domains staff use — while
 * its `auth.ts` sent `APP_KEY = 'exam-module'` through `orgSignInAllowed` with the OU gate applying,
 * and its own wiring test asserted "is staff-only". Provisioning the credential on THAT Railway
 * service would have refused every student at once, on exam day, with a console.warn. Parents are
 * not admitted there (no parent identity exists; roles.ts decides that), so this entry is a
 * student-only exemption riding the list's understated name, exactly as the paragraph above allows.
 *
 * WHY career-counselling HAD TO BE ADDED, and what it was heading for. Its `lib/auth/roles.ts`
 * resolves a STUDENT by school email (:73-79) and a PARENT by `Student.parentEmail` (:93-109,
 * `PARENT_PILOT_COHORTS = [2027]`, verified 2026-08-12 as 150 students with 145 carrying a parent
 * alias). Its `APP_KEY` went to `orgSignInAllowed` with the OU gate applying, and that gate refuses
 * a 'not-staff' verdict with nothing but a `console.warn`. So the day `GOOGLE_SA_KEY` +
 * `STAFF_OU_PATHS` are provisioned — the estate credential BACKLOG.md has carried as
 * `[awaiting-you]` for weeks — every student and every piloted parent would have lost sign-in at
 * once, silently, on a live app. The credential is still unset, so nothing was broken yet; this is
 * the fix landing BEFORE the switch rather than after the lockout.
 */
export const PARENT_OPEN_APPS: readonly string[] = [
  'cafeteria-checkin',
  'nucleus-parent',
  'career-counselling',
  'exam-module',
];

/** Does the staff-OU gate apply to this app? `appKey` is the app's DIRECTORY NAME in the repo. */
export function staffOuGateAppliesTo(appKey: string): boolean {
  return !PARENT_OPEN_APPS.includes(appKey.trim().toLowerCase());
}

// ---- environment ---------------------------------------------------------------------------

type Env = Record<string, string | undefined>;

/** 12 hours. A new campus domain works within half a day of being created, and a Workspace that
 *  goes unreachable costs at most one refresh attempt per instance per 12h. */
const TTL_MS = 12 * 60 * 60 * 1000;

/** After a FAILED attempt, do not try again for this long. Without it every sign-in during a
 *  Google outage pays the full timeout, which turns a degraded dependency into a slow front
 *  door — the list is already being served from cache or seed, so there is nothing to gain. */
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

/** A hung fetch on the sign-in path is worse than a stale list. Overridable for a slow network. */
const DEFAULT_TIMEOUT_MS = 4000;

const DOMAINS_SCOPE = 'https://www.googleapis.com/auth/admin.directory.domain.readonly';
const USERS_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DIRECTORY_BASE = 'https://admin.googleapis.com/admin/directory/v1';

/**
 * Normalise a comma-separated domain list. Tolerates a leading "@", stray case and whitespace —
 * and DROPS any entry containing a wildcard, because "everyone" is not a value this module is
 * allowed to express. An operator who sets AUTH_ALLOWED_DOMAINS=* gets an empty override, which
 * falls through to the resolved list, not to an open door.
 */
function parseDomainList(raw: string | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? '').split(',')) {
    const d = part.trim().toLowerCase().replace(/^@/, '');
    if (!d || d.includes('*')) continue;
    seen.add(d);
  }
  return [...seen];
}

/** The operator override. Non-empty ⇒ it wins over everything, and no network call is made. */
export function allowedDomainsOverride(env: Env = process.env): string[] {
  return parseDomainList(env.AUTH_ALLOWED_DOMAINS);
}

function serviceAccount(env: Env): { clientEmail: string; privateKey: string } | null {
  const raw = env.GOOGLE_SA_KEY?.trim();
  if (!raw) return null;
  try {
    // The SA JSON is ASCII, so atob is enough and is edge-safe (Node Buffer is not available
    // in the edge runtime, and importing node:buffer would poison the middleware bundle).
    const json = raw.startsWith('{') ? raw : atob(raw);
    const parsed = JSON.parse(json) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

/**
 * True only when the Workspace lookup can actually run. A screen may say "not configured" on the
 * strength of this and be telling the truth — which is the point: a dormant capability that
 * reports itself as working is how "[awaiting-you]" items sit for weeks.
 */
export function orgDomainGateConfigured(env: Env = process.env): boolean {
  return !!serviceAccount(env) && !!env.GOOGLE_ADMIN_SUBJECT?.trim();
}

/** The allowed staff OU prefixes, e.g. "/Staff,/Staff/Teaching". Empty ⇒ the OU gate is off. */
function staffOuPaths(env: Env): string[] {
  return (env.STAFF_OU_PATHS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** True only when the staff-OU gate is fully configured. Independently dormant from the domain
 *  resolver above: the same service account carries both scopes, but STAFF_OU_PATHS is a
 *  separate decision and an app may want one without the other. */
export function staffOuGateConfigured(env: Env = process.env): boolean {
  return orgDomainGateConfigured(env) && staffOuPaths(env).length > 0;
}

// ---- the service-account assertion (WebCrypto; see the header for why not jose) ---------------

// These return ArrayBuffer rather than Uint8Array deliberately. crypto.subtle's parameters are
// `BufferSource`, and under @types/node ≥22 a Uint8Array is generic over ArrayBufferLike — which
// includes SharedArrayBuffer and is therefore NOT assignable to BufferSource. That mismatch is a
// type error in some apps' TypeScript and not in others, which is exactly what a byte-identical
// copy cannot afford. ArrayBuffer is assignable everywhere, in every version.
function utf8(s: string): ArrayBuffer {
  const src = new TextEncoder().encode(s);
  const out = new ArrayBuffer(src.byteLength);
  new Uint8Array(out).set(src);
  return out;
}

function base64url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < view.length; i += 1) s += String.fromCharCode(view[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PEM (PKCS#8, "BEGIN PRIVATE KEY") → the DER bytes crypto.subtle.importKey wants. */
function pkcs8Der(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new ArrayBuffer(bin.length);
  const view = new Uint8Array(out);
  for (let i = 0; i < bin.length; i += 1) view[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Sign an RS256 JWT with a PKCS#8 PEM private key. Exported so the tests can round-trip it
 * against a key generated by WebCrypto itself — this is the one piece that was not lifted
 * verbatim from a working implementation, so it is the one piece that is proved rather than
 * trusted. Returns null (never throws) when WebCrypto is unavailable or the key will not parse:
 * a caller that cannot mint a token serves the cache or the seed, which is the safe direction.
 */
export async function signJwtRS256(
  claims: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  try {
    const key = await subtle.importKey(
      'pkcs8',
      pkcs8Der(privateKeyPem),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signingInput =
      `${base64url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))}.` +
      `${base64url(utf8(JSON.stringify(claims)))}`;
    const sig = await subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, utf8(signingInput));
    return `${signingInput}.${base64url(sig)}`;
  } catch {
    return null;
  }
}

let tokenCache: { token: string; scope: string; expSec: number } | null = null;

/**
 * A Directory-API access token for `scope`, impersonating GOOGLE_ADMIN_SUBJECT. Returns null on
 * ANY problem — unconfigured, unsigned, refused, unparseable. Never throws: this runs inside a
 * sign-in callback, where a thrown error is a refused sign-in.
 *
 * Shared by the domain resolver and the staff-OU lookup so there is ONE implementation of the
 * service-account dance in the estate rather than two (ibdp-results/lib/auth/org-directory.ts
 * now re-exports this module rather than carrying its own).
 */
export async function getOrgAccessToken(scope: string, env: Env = process.env): Promise<string | null> {
  const sa = serviceAccount(env);
  const subject = env.GOOGLE_ADMIN_SUBJECT?.trim();
  if (!sa || !subject) return null;
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.scope === scope && tokenCache.expSec - 60 > now) return tokenCache.token;
  try {
    const assertion = await signJwtRS256(
      { iss: sa.clientEmail, sub: subject, aud: TOKEN_URL, scope, iat: now, exp: now + 3600 },
      sa.privateKey,
    );
    if (!assertion) return null;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
      signal: timeoutSignal(env),
    });
    if (!res.ok) {
      console.warn('[org-domains] token exchange failed:', res.status);
      return null;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    tokenCache = { token: data.access_token, scope, expSec: now + (data.expires_in ?? 3600) };
    return data.access_token;
  } catch (e) {
    console.warn('[org-domains] token error:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** AbortSignal.timeout where it exists; undefined where it does not (older runtimes) rather
 *  than a hand-rolled controller nobody clears. */
function timeoutSignal(env: Env): AbortSignal | undefined {
  const ms = Number(env.ORG_DOMAINS_TIMEOUT_MS ?? '') || DEFAULT_TIMEOUT_MS;
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

// ---- the resolved list ------------------------------------------------------------------------

interface DomainsCache {
  domains: string[];
  fetchedAtMs: number;
}

/** LAST GOOD value only. A failed fetch never evicts this — that is the whole contract. */
let cache: DomainsCache | null = null;
let inFlight: Promise<string[]> | null = null;
let lastFailureMs = 0;
let lastError: string | null = null;

/** Test seam. Never called by app code; the module-level cache is per-instance and per-process. */
export function __resetOrgDomainsCache(): void {
  cache = null;
  inFlight = null;
  lastFailureMs = 0;
  lastError = null;
  tokenCache = null;
}

const withPartners = (domains: readonly string[]): string[] =>
  [...new Set([...domains, ...PARTNER_ORG_DOMAINS].map((d) => d.trim().toLowerCase()).filter(Boolean))];

/**
 * The org's domains WITHOUT touching the network — the operator override if set, else the last
 * good Workspace answer if one has been fetched by this instance, else the seed.
 *
 * Safe to call from anywhere, including the edge: it performs no I/O. Use it wherever the caller
 * cannot be async (a middleware decision, a rendered login page, a pure classifier's default).
 * The list it returns is never empty and never a wildcard.
 */
export function orgDomainsSync(env: Env = process.env): string[] {
  const override = allowedDomainsOverride(env);
  if (override.length > 0) return override;
  return withPartners(cache?.domains ?? SEED_ORG_DOMAINS);
}

/**
 * The org's domains, refreshing from the Workspace Admin API when that is configured and the
 * cached answer has aged past the TTL.
 *
 * NEVER THROWS and never returns an empty list. Every failure path — unconfigured, no token,
 * HTTP error, malformed body, an empty `domains` array, a timeout — falls back to the last good
 * value, and to the seed when there is none. That ordering is the ruling's "until that lands,
 * the ten-domain list is still the source of truth", expressed as code rather than as a comment.
 */
export async function resolveOrgDomains(env: Env = process.env): Promise<string[]> {
  const override = allowedDomainsOverride(env);
  if (override.length > 0) return override;
  // Not configured ⇒ exactly what the sync accessor would say (last good value if this instance
  // ever had one, else the seed). Deliberately the SAME expression rather than a bare seed: a
  // credential removed mid-process must not make the two accessors disagree about who may sign
  // in, and this direction can only ever widen, never narrow.
  if (!orgDomainGateConfigured(env)) return orgDomainsSync(env);

  const now = Date.now();
  if (cache && now - cache.fetchedAtMs < TTL_MS) return withPartners(cache.domains);
  if (now - lastFailureMs < FAILURE_BACKOFF_MS) return orgDomainsSync(env);

  // One refresh in flight per instance: a burst of sign-ins must not become a burst of
  // Directory API calls, each paying the full timeout.
  if (!inFlight) {
    inFlight = fetchOrgDomains(env)
      .then((fetched) => {
        // AN EMPTY ANSWER IS A FAILURE, NOT AN ANSWER. A Workspace that reports zero verified
        // domains — a mis-scoped service account, a customer id that resolved to nothing, a
        // response shape that changed — would otherwise refuse every sign-in in the estate at
        // once. Keep the last good value and say so.
        if (fetched.length === 0) {
          lastFailureMs = Date.now();
          lastError = 'the Workspace returned no verified domains';
          console.warn('[org-domains] empty domain list from Google — keeping the previous list');
          return cache?.domains ?? [...SEED_ORG_DOMAINS];
        }
        cache = { domains: fetched, fetchedAtMs: Date.now() };
        lastError = null;
        return fetched;
      })
      .catch((e) => {
        lastFailureMs = Date.now();
        lastError = e instanceof Error ? e.message : String(e);
        console.warn('[org-domains] domain lookup failed:', lastError);
        return cache?.domains ?? [...SEED_ORG_DOMAINS];
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return withPartners(await inFlight);
}

/**
 * The raw Workspace answer: every VERIFIED domain, plus every VERIFIED alias.
 *
 * `verified: false` is dropped deliberately and in both places. An unverified domain is one
 * somebody typed into the Admin console and has not proved they own — admitting it would let
 * whoever actually owns that domain sign in to sixteen internal apps.
 */
async function fetchOrgDomains(env: Env): Promise<string[]> {
  const token = await getOrgAccessToken(DOMAINS_SCOPE, env);
  if (!token) throw new Error('no service-account access token');
  const res = await fetch(`${DIRECTORY_BASE}/customer/my_customer/domains`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: timeoutSignal(env),
  });
  if (!res.ok) throw new Error(`domains.list returned ${res.status}`);
  const data = (await res.json()) as {
    domains?: {
      domainName?: string;
      verified?: boolean;
      domainAliases?: { domainAliasName?: string; verified?: boolean }[];
    }[];
  };
  const out = new Set<string>();
  for (const d of data.domains ?? []) {
    if (d.verified === true && d.domainName) out.add(d.domainName.trim().toLowerCase());
    for (const a of d.domainAliases ?? []) {
      if (a.verified === true && a.domainAliasName) out.add(a.domainAliasName.trim().toLowerCase());
    }
  }
  return [...out].filter(Boolean);
}

export type OrgDomainsSource = 'override' | 'workspace' | 'seed';

export interface OrgDomainsStatus {
  /** Can the Workspace lookup run at all? False ⇒ a screen may honestly say "not configured". */
  configured: boolean;
  /** Where the list currently being served came from. */
  source: OrgDomainsSource;
  domains: string[];
  /** When the Workspace last answered on this instance, ISO — null if it never has. */
  fetchedAt: string | null;
  /** Past the TTL, so the next resolve will try to refresh. */
  stale: boolean;
  /** The last failure's message, kept so a screen can show WHY it is serving a stale list. */
  lastError: string | null;
}

/** Everything a settings screen needs to tell the truth about this gate, without doing I/O. */
export function orgDomainsStatus(env: Env = process.env): OrgDomainsStatus {
  const override = allowedDomainsOverride(env);
  const source: OrgDomainsSource = override.length > 0 ? 'override' : cache ? 'workspace' : 'seed';
  return {
    configured: orgDomainGateConfigured(env),
    source,
    domains: orgDomainsSync(env),
    fetchedAt: cache ? new Date(cache.fetchedAtMs).toISOString() : null,
    stale: !!cache && Date.now() - cache.fetchedAtMs >= TTL_MS,
    lastError,
  };
}

// ---- the domain check itself --------------------------------------------------------------

/**
 * Is `email`'s domain on `allowed`? Compares the LAST "@" segment, so a display-style address
 * ("Name <a@b.org>") or a local part containing "@" cannot smuggle a foreign domain past.
 *
 * An empty `allowed` denies everyone. That is deliberate and is the reason the resolvers above
 * are incapable of returning one: the fail-open reading of "no list configured" is exactly the
 * bug this estate has already shipped once.
 */
export function emailDomainAllowed(
  email: string | null | undefined,
  allowed: readonly string[],
): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at === -1) return false;
  const domain = normalized.slice(at + 1);
  if (domain === '') return false;
  return allowed.includes(domain);
}

/** The synchronous domain gate — for callers that cannot await (edge middleware, a login page). */
export function orgDomainAllowedSync(email: string | null | undefined, env: Env = process.env): boolean {
  return emailDomainAllowed(email, orgDomainsSync(env));
}

/** The domain gate on the Node sign-in path, refreshing the org list when it is configured. */
export async function orgDomainAllowed(email: string | null | undefined, env: Env = process.env): Promise<boolean> {
  return emailDomainAllowed(email, await resolveOrgDomains(env));
}

// ---- B1: the staff Organisational Unit ------------------------------------------------------
//
// The domain check alone is not enough. Students, parents and alumni hold addresses on exactly
// the same ten domains as staff, so "is this a Fountainhead address" and "is this a colleague"
// are different questions. B1: staff by default, with the two named exceptions in
// PARENT_OPEN_APPS above.
//
// Independently dormant from the domain resolver: with STAFF_OU_PATHS unset this half never
// runs and every caller keeps today's behaviour exactly.

/** PURE: is an orgUnitPath under one of the allowed staff OU prefixes? Segment-aware, so
 *  "/StaffRoom" does not match "/Staff". */
export function isUnderStaffOu(orgUnitPath: string | null | undefined, staffPaths: readonly string[]): boolean {
  if (!orgUnitPath) return false;
  const p = orgUnitPath.replace(/\/+$/, '');
  return staffPaths.some((s) => {
    const base = s.replace(/\/+$/, '');
    return base !== '' && (p === base || p.startsWith(base + '/'));
  });
}

/**
 * 'not-configured' — STAFF_OU_PATHS / the service account are unset. The caller keeps today's
 *                    behaviour; this is the state the whole estate is in as this ships.
 * 'unavailable'    — configured, but Google could not be reached or refused. The caller decides:
 *                    B1 says "fail towards today's behaviour, never towards a closed door", so a
 *                    sign-in gate should treat this as "domain check only", not as a refusal.
 * 'staff' / 'not-staff' — an actual answer.
 *
 * Never throws. The four-way answer exists so the caller is forced to think about the third
 * case: `boolean` collapses "we do not know" into one of the two answers, and whichever way it
 * collapses is wrong half the time.
 */
export type StaffOuVerdict = 'staff' | 'not-staff' | 'unavailable' | 'not-configured';

export async function staffOuVerdict(email: string, env: Env = process.env): Promise<StaffOuVerdict> {
  if (!staffOuGateConfigured(env)) return 'not-configured';
  const token = await getOrgAccessToken(USERS_SCOPE, env);
  if (!token) return 'unavailable';
  try {
    const url = `${DIRECTORY_BASE}/users/${encodeURIComponent(email)}?fields=orgUnitPath`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal(env) });
    // A 404 is an ANSWER: the Directory has no such user, so they are not staff. Every other
    // non-OK status is the API failing, which is not an answer about this person.
    if (res.status === 404) return 'not-staff';
    if (!res.ok) {
      console.warn('[org-domains] user lookup failed for', email, res.status);
      return 'unavailable';
    }
    const data = (await res.json()) as { orgUnitPath?: string };
    return isUnderStaffOu(data.orgUnitPath, staffOuPaths(env)) ? 'staff' : 'not-staff';
  } catch (e) {
    console.warn('[org-domains] lookup error:', e instanceof Error ? e.message : e);
    return 'unavailable';
  }
}

/**
 * FAIL-CLOSED boolean form: only a definite 'staff' answers true. Kept because
 * ibdp-results/lib/auth/gate.ts has depended on exactly this shape since the staff-OU gate was
 * written, and only calls it behind staffOuGateConfigured(). New callers should prefer
 * staffOuVerdict() and handle 'unavailable' deliberately.
 */
export async function isStaffEmail(email: string, env: Env = process.env): Promise<boolean> {
  return (await staffOuVerdict(email, env)) === 'staff';
}

// ---- the whole front door, in one call ------------------------------------------------------

/**
 * THE sign-in decision ruling 13 asks every app for: an org domain, AND — unless this app is one
 * of B1's parent-open exceptions — the staff Organisational Unit.
 *
 * This lives HERE rather than being written out in each app's own gate because it is the one
 * piece of new logic all sixteen apps share, and the piece where getting it wrong in ONE app
 * locks that app's staff out. `appKey` is the app's DIRECTORY NAME in this repo.
 *
 * The precedence, and why each step falls the way it does:
 *
 *   1. AUTH_ALLOWED_DOMAINS, if set, has already won inside resolveOrgDomains — an operator
 *      mid-incident is never second-guessed here.
 *   2. Not on an org domain ⇒ denied. This is today's behaviour and the only hard refusal.
 *   3. A parent-open app (cafeteria-checkin, nucleus-parent) never consults the OU: parents are
 *      the point of those two, and a staff-only check would invert them.
 *   4. The OU gate unconfigured ⇒ allowed on the domain alone — which is the ENTIRE ESTATE
 *      today, and is exactly the "ships dormant" promise.
 *   5. Configured, and Google says 'not-staff' ⇒ denied. The only case that newly refuses
 *      anyone, and it is B1's whole purpose: students, parents and alumni hold addresses on the
 *      same ten domains as staff.
 *   6. Configured but 'unavailable' (Google unreachable, refused, timed out) ⇒ ALLOWED on the
 *      domain alone. Deliberately not a refusal: a Directory outage must not become an estate
 *      outage, and this degrades to precisely the gate that stood the day before.
 *
 * Never throws — a thrown error inside an Auth.js signIn callback is a refused sign-in.
 */
export async function orgSignInAllowed(
  email: string | null | undefined,
  appKey: string,
  env: Env = process.env,
): Promise<boolean> {
  if (!(await orgDomainAllowed(email, env))) return false;
  if (!staffOuGateAppliesTo(appKey)) return true;
  if (!staffOuGateConfigured(env)) return true;
  const verdict = await staffOuVerdict((email ?? '').trim().toLowerCase(), env);
  if (verdict === 'not-staff') {
    console.warn('[org-domains] sign-in denied — not under the staff OU');
    return false;
  }
  return true;
}
