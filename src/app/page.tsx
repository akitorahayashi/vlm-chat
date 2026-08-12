import Image from 'next/image';
import { connection } from 'next/server';
import { readHomeGreeting } from '@/features/greeting/read';

export default async function Page() {
  await connection();
  const message = await readHomeGreeting();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 sm:px-10">
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
              <Image src="/globe.svg" alt="" width={18} height={18} priority />
            </span>
            <span className="font-mono text-sm font-semibold">next-bun</span>
          </div>
          <span>
            <span className="block size-2 bg-emerald-500" aria-hidden="true" />
            <span className="sr-only">Application ready</span>
          </span>
        </header>

        <section className="flex flex-1 items-center py-16">
          <div className="max-w-3xl">
            <p className="mb-5 font-mono text-xs uppercase text-emerald-700 dark:text-emerald-400">
              Ready
            </p>
            <h1 className="max-w-full text-5xl font-semibold leading-tight">
              {message}
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
              A clean beginning.
            </p>
          </div>
        </section>

        <footer className="flex h-16 shrink-0 items-center border-t border-zinc-200 font-mono text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          next-bun
        </footer>
      </div>
    </main>
  );
}
