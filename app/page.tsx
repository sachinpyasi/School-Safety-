import { redirect } from 'next/navigation';

// One page so far. The day a second one lands this becomes a landing page.
export default function Home() {
  redirect('/posh');
}
