'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ConversationSummary } from '@/features/conversation/list';
import { describeError } from '@/lib/describe-error';
import { ErrorBanner } from './error-banner';

export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    let response: Response;

    try {
      response = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    } catch (cause) {
      setError(`Could not delete the conversation: ${describeError(cause)}`);
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? `Delete failed with status ${response.status}.`);
      return;
    }

    if (id === activeId) {
      router.replace('/');
    } else {
      router.refresh();
    }
  }

  return (
    <nav className="flex w-full shrink-0 flex-col gap-3 border-b border-zinc-200 py-4 md:w-56 md:border-r md:border-b-0 md:pr-4 dark:border-zinc-800">
      <Link
        href="/"
        className="border border-zinc-300 px-3 py-1.5 text-center font-mono text-xs uppercase dark:border-zinc-700"
      >
        New chat
      </Link>

      {error ? <ErrorBanner message={error} /> : null}

      <ul className="flex max-h-32 flex-col overflow-y-auto md:max-h-none">
        {conversations.map((conversation) => (
          <li
            key={conversation.id}
            className="group flex items-center justify-between gap-2"
          >
            <Link
              href={`/conversations/${conversation.id}`}
              aria-current={conversation.id === activeId ? 'page' : undefined}
              className={`min-w-0 flex-1 truncate py-1.5 text-sm ${
                conversation.id === activeId
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {conversation.title}
            </Link>
            <button
              type="button"
              aria-label={`Delete ${conversation.title}`}
              onClick={() => void remove(conversation.id)}
              className="shrink-0 font-mono text-xs text-zinc-400 hover:text-red-600"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
