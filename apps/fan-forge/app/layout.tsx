import { PollarProvider } from '@pollar/react';
import './globals.css';
import type { Metadata } from 'next';
import { Space_Mono, Syne } from 'next/font/google';
import '@pollar/react/styles.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
});

export const metadata: Metadata = {
  title: 'FanForge',
  description: 'AI plays. Fans forge the outcome.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable} h-full`}>
      <body className="min-h-full">
        <PollarProvider config={{ apiKey: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY! }}>
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
