import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ChatView } from '@/app/_components/chat-view';
import { ConversationList } from '@/app/_components/conversation-list';
import { listConversations } from '@/features/conversation/list';
import { readConversation } from '@/features/conversation/read';

export default async function Page({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  await connection();

  const { conversationId } = await params;
  const [conversation, conversations] = await Promise.all([
    readConversation(conversationId),
    listConversations(),
  ]);

  if (!conversation) {
    notFound();
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-6">
      <ConversationList
        conversations={conversations}
        activeId={conversation.id}
      />
      {/* Keyed so switching conversations remounts with the server-rendered
          transcript as the authority instead of merging into stale state. */}
      <ChatView
        key={conversation.id}
        conversationId={conversation.id}
        messages={conversation.messages}
        modelId={conversation.modelId}
      />
    </main>
  );
}
