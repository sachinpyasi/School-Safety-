import type { Metadata, Viewport } from 'next';
import './globals.css';

// Root layout: login, logout and the signed-in (app) group.
export const metadata: Metadata = {
  title: 'School Safety HQ',
  description: 'Fountainhead Schools safety compliance — POSH / POCSO training (prototype).',
};

export const viewport: Viewport = {
  themeColor: '#01427C',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
