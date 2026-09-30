import { requireUser } from '@/lib/auth/guard';
import { rightsAdminEmails } from '@/lib/auth/access';
import { listGrants } from '@/lib/rights';
import { POSH_UNITS, unitName } from '@/engine/posh';
import { fmtDate } from '@/engine/ist';
import { grantAction, revokeAction } from './actions';
import { ConfirmForm } from '../_ConfirmForm';

export const dynamic = 'force-dynamic';

// Who may change the POSH / POCSO records. Everyone signed in can read this list (knowing who to ask
// is the point of it); only a rights administrator sees the add and remove controls, and the
// actions re-check that on the server regardless.
//
// The search is a plain GET form over the list this page already holds, so it works without
// JavaScript and survives a reload. It filters the ACCESS REGISTER, never the staff roster.

export default async function RightsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const grants = await listGrants();
  const admins = rightsAdminEmails();
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 120);
  const shown = q
    ? grants.filter((g) => g.user.email.includes(q) || g.user.name.toLowerCase().includes(q) || unitName(g.unit ?? 'every unit').toLowerCase().includes(q))
    : grants;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Who can edit</h1>
          <p className="sub">
            Everyone with a school Google account can see the records. Only the people below can change them, and only
            for the units they hold.
          </p>
        </div>
      </div>

      {sp.ok && (
        <div className="alert ok" role="status">
          {sp.ok}
        </div>
      )}
      {sp.error && (
        <div className="alert bad" role="alert">
          {sp.error}
        </div>
      )}

      <div className="card">
        <h2>Grants</h2>
        {grants.length > 0 && (
          <form method="get" className="row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label htmlFor="q">Find a person or unit</label>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="name, email or unit" />
            </div>
            <button type="submit" className="btn ghost sm">
              Search
            </button>
            {q && (
              <a href="/rights" className="btn ghost sm">
                Clear
              </a>
            )}
          </form>
        )}
        {q && (
          <p className="note" role="status" style={{ marginBottom: 8 }}>
            Showing {shown.length} of {grants.length} grants matching &ldquo;{q}&rdquo;.
          </p>
        )}
        {grants.length === 0 ? (
          <p className="muted">Nobody has been granted anything yet. The administrators below can edit every unit meanwhile.</p>
        ) : shown.length === 0 ? (
          <p className="muted">No grant matches that search.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Can edit</th>
                  <th>Since</th>
                  <th>Granted by</th>
                  {user.isRightsAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <tr key={g.id}>
                    <td>{g.user.name}</td>
                    <td className="muted">{g.user.email}</td>
                    <td>{g.unit === null ? 'Every unit' : unitName(g.unit)}</td>
                    <td className="muted nowrap">{fmtDate(g.createdAt)}</td>
                    <td className="muted clip">{g.grantedBy ?? ''}</td>
                    {user.isRightsAdmin && (
                      <td className="nowrap">
                        <ConfirmForm
                          action={revokeAction}
                          message={`Stop ${g.user.email} editing ${g.unit === null ? 'every unit' : unitName(g.unit)}?`}
                        >
                          <input type="hidden" name="id" value={g.id} />
                          <button type="submit" className="btn danger sm">
                            Remove
                          </button>
                        </ConfirmForm>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {user.isRightsAdmin && (
        <div className="card">
          <h2>Give someone edit rights</h2>
          <form action={grantAction} className="row">
            <div className="field">
              <label htmlFor="email">School email</label>
              <input id="email" name="email" type="email" required placeholder="name@fountainheadschools.org" />
            </div>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" placeholder="As it should appear here" />
            </div>
            <div className="field">
              <label htmlFor="unit">Unit</label>
              <select id="unit" name="unit" defaultValue="" required>
                <option value="" disabled>
                  Choose…
                </option>
                <option value="ALL">Every unit</option>
                {POSH_UNITS.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn">
              Grant
            </button>
          </form>
          <p className="note" style={{ marginTop: 10 }}>
            It works from their very next page, with no need to sign out. Two units means two grants.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Administrators</h2>
        <p className="sub" style={{ marginBottom: 8 }}>
          Set by the <code>RIGHTS_ADMIN_EMAILS</code> variable on the server. They give and take away grants, can edit every
          unit, and can delete a year.
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {admins.map((a) => (
            <li key={a} className="muted">
              {a}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
