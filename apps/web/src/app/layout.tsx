import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { PollarProvider } from "@pollar/react";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fan Match — Live Chat",
  description: "Live chat for sports fans",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <PollarProvider
          config={{ apiKey: process.env.NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY! }}
        >
          {children}
        </PollarProvider>
      </body>
    </html>
  );
}
