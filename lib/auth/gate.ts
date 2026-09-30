// lib/auth/gate.ts — the SIGN-IN gate: which email domains may reach this app at all.
//
// The Fountainhead org spans multiple email domains, not just fountainheadschools.org — campuses,
// entities and one service vendor each have their own. Allowing only the primary domain silently
// locks out real staff; that has happened before in this estate. Ruling 13 applies unchanged: the
// list is never narrowed per app, and a colleague on any org domain may sign in.
//
// The list itself lives in lib/auth/org-domains.ts, which can read the org's domains from the
// Google Workspace Admin API when that is configured and serves its built-in seed list until it
// is. DORMANT as it ships: with GOOGLE_SA_KEY / GOOGLE_ADMIN_SUBJECT unset every function below
// answers from the seed.
//
// Being on an allowed domain gates SIGN-IN ONLY. It never implies the right to change a record: that
// is an AppUserRight row or RIGHTS_ADMIN_EMAILS (lib/rights.ts).
import {
  SEED_ORG_DOMAINS,
  emailDomainAllowed as orgEmailDomainAllowed,
  orgDomainsSync,
  orgSignInAllowed,
  resolveOrgDomains,
} from './org-domains';

/** The seed org-domain list, re-exported under the name the login page renders. To change the
 *  list: edit SEED_ORG_DOMAINS in ./org-domains.ts, or set AUTH_ALLOWED_DOMAINS on the host — never here,
 *  and check with the school's IT first: a missing domain silently refuses real staff. */
export const DEFAULT_ALLOWED_DOMAINS = SEED_ORG_DOMAINS;

/** This app's DIRECTORY NAME, checked against the module's PARENT_OPEN_APPS to decide whether B1's
 *  staff-OU gate applies here. It does: safety compliance is staff-only. */
const APP_KEY = 'school-safety';

/** The org's domains WITHOUT touching the network: AUTH_ALLOWED_DOMAINS if set, else the last good
 *  Workspace answer, else the seed. Never empty, never "everyone". */
export function allowedDomains(env: Record<string, string | undefined> = process.env): string[] {
  return orgDomainsSync(env);
}

export async function allowedDomainsAsync(
  env: Record<string, string | undefined> = process.env,
): Promise<string[]> {
  return resolveOrgDomains(env);
}

/** True only if `email`'s domain is on `allowed`. Compares the LAST "@" segment. */
export function isAllowedEmail(email: string | null | undefined, allowed: string[] = allowedDomains()): boolean {
  return orgEmailDomainAllowed(email, allowed);
}

/** THE sign-in rule on the Node path — what the Auth.js signIn callback calls. */
export async function canSignInAsync(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  return orgSignInAllowed(email, APP_KEY, env);
}
