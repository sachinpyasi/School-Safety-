'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/access';
import { grantRight, revokeRight, RightsError } from '@/lib/rights';
import { unitName } from '@/engine/posh';

// Server actions for /rights. Every one resolves the signed-in user HERE, so the form can claim
// nothing about who is submitting it.
function back(params: Record<string, string>): never {
  redirect(`/rights?${new URLSearchParams(params).toString()}`);
}

function message(err: unknown): string {
  if (err instanceof RightsError) return err.message;
  console.error('[rights] unexpected failure', err);
  return 'Something went wrong. Nothing was changed.';
}

export async function grantAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  let res;
  try {
    res = await grantRight(user, String(fd.get('email') ?? ''), String(fd.get('name') ?? ''), String(fd.get('unit') ?? ''));
  } catch (err) {
    back({ error: message(err) });
  }
  const scope = res.unit === null ? 'every unit' : unitName(res.unit);
  back({ ok: res.created ? `${res.email} can now edit ${scope}.` : `${res.email} could already edit ${scope}.` });
}

export async function revokeAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  try {
    await revokeRight(user, String(fd.get('id') ?? ''));
  } catch (err) {
    back({ error: message(err) });
  }
  back({ ok: 'Grant removed.' });
}
