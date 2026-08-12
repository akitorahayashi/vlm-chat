import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'VLM Chat',
  description: 'A local vision-language chat client for mlx-vlm.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto flex h-screen w-full max-w-6xl flex-col px-6 sm:px-10">
          <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800">
            <Link href="/" className="font-mono text-sm font-semibold">
              vlm-chat
            </Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
