import { Loader } from './_Loader';

// Shown while any page outside the signed-in group loads (sign-in, sign-out, the first redirect).
export default function Loading() {
  return <Loader />;
}
