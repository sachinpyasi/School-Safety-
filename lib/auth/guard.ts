// Page guards — resolve the identity and redirect when it is missing. redirect() throws, so the
// returned user is always non-null past the call.
import { redirect } from 'next/navigation';
import { getCurrentUser, type SignedInUser } from './access';

export async function requireUser(): Promise<SignedInUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
