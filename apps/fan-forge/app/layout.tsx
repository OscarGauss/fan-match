import type { Metadata } from 'next'
import { Syne } from 'next/font/google'
import { Space_Mono } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
})

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
})

export const metadata: Metadata = {
  title: 'FanForge',
  description: 'AI plays. Fans forge the outcome.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${spaceMono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  )
}
