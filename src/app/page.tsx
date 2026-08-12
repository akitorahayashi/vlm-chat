import { connection } from 'next/server';
import { listConversations } from '@/features/conversation/list';
import { ChatView } from './_components/chat-view';
import { ConversationList } from './_components/conversation-list';

// Without this the route is prerendered at build time, which would read a
// database that has not been migrated yet.
export default async function Page() {
  await connection();

  const conversations = await listConversations();

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-6">
      <ConversationList conversations={conversations} activeId={null} />
      <ChatView conversationId={null} messages={[]} modelId={null} />
    </main>
  );
}
