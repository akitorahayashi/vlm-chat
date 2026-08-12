import { describe, expect, it } from 'bun:test';
import type { ChatEvent } from '@/lib/chat-event';
import {
  contentOnlyStream,
  midStreamErrorStream,
  reasoningThenContentStream,
  slowStream,
  truncatedStream,
} from './fixtures/completion-chunks';
import { startConversation } from './fixtures/conversation';
import {
  type InferenceStubScript,
  startInferenceStub,
} from './fixtures/inference-stub';

async function post(body: unknown, signal?: AbortSignal) {
  const { POST } = await import('@/app/api/chat/route');

  return POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }),
  );
}

async function readEvents(
  response: Response,
  onEvent?: (event: ChatEvent) => void,
) {
  const { readServerSentEvents } = await import('@/lib/server-sent-events');
  const { decodeChatEvent } = await import('@/lib/chat-event');
  const events: ChatEvent[] = [];
  const body = response.body;

  if (!body) {
    throw new Error(`The chat route answered ${response.status} with no body.`);
  }

  try {
    for await (const payload of readServerSentEvents(body)) {
      const event = decodeChatEvent(payload);

      events.push(event);
      onEvent?.(event);
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'AbortError') {
      throw error;
    }
  }

  return events;
}

async function cancel(messageId: string) {
  const { DELETE } = await import('@/app/api/completions/[messageId]/route');

  return DELETE(
    new Request(`http://localhost/api/completions/${messageId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ messageId }) },
  );
}

function useStub(script: InferenceStubScript) {
  const stub = startInferenceStub(script);

  process.env.VLM_CHAT_INFERENCE_URL = stub.url;

  return stub;
}

async function readMessages(conversationId: string) {
  const { prisma } = await import('@/lib/prisma');

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { sequence: 'asc' },
  });
}

describe('chat route', () => {
  it('streams a reply and stores it as one assistant turn', async () => {
    const stub = useStub({ chunks: contentOnlyStream });

    try {
      const events = await readEvents(
        await post({ modelId: 'stub/model', text: 'hi' }),
      );
      const start = events[0];

      expect(start.type).toBe('start');
      expect(events.at(-1)).toEqual({ type: 'end', finishReason: 'stop' });
      expect(
        events
          .filter((event) => event.type === 'delta')
          .map((event) => event.content)
          .join(''),
      ).toBe('Hello');

      const conversationId =
        start.type === 'start' ? start.conversationId : 'none';
      const messages = await readMessages(conversationId);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({ role: 'user', content: 'hi' });
      expect(messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hello',
        status: 'complete',
        finishReason: 'stop',
        modelId: 'stub/model',
      });
      expect(messages[1].seed).toBeGreaterThanOrEqual(0);
    } finally {
      stub.stop();
    }
  });

  it('keeps reasoning out of the answer', async () => {
    const stub = useStub({ chunks: reasoningThenContentStream });

    try {
      const events = await readEvents(
        await post({ modelId: 'stub/model', text: 'colour?' }),
      );
      const start = events[0];
      const conversationId =
        start.type === 'start' ? start.conversationId : 'none';
      const [, assistant] = await readMessages(conversationId);

      expect(assistant.content).toBe('Blue.');
      expect(assistant.reasoning).toBe('weighing options');
    } finally {
      stub.stop();
    }
  });

  it('does not send enable_thinking upstream', async () => {
    const stub = useStub({ chunks: contentOnlyStream });

    try {
      await readEvents(await post({ modelId: 'stub/model', text: 'hi' }));

      expect(stub.received).toHaveLength(1);
      expect(stub.received[0]).not.toHaveProperty('enable_thinking');
      expect(stub.received[0]).toMatchObject({
        model: 'stub/model',
        stream: true,
      });
    } finally {
      stub.stop();
    }
  });

  it('keeps the partial answer when the stream fails part-way', async () => {
    const stub = useStub({ chunks: midStreamErrorStream });

    try {
      const events = await readEvents(
        await post({ modelId: 'stub/model', text: 'hi' }),
      );
      const start = events[0];

      expect(events.at(-1)).toEqual({
        type: 'error',
        message: 'the model ran out of memory',
      });

      const conversationId =
        start.type === 'start' ? start.conversationId : 'none';
      const [, assistant] = await readMessages(conversationId);

      expect(assistant).toMatchObject({
        status: 'failed',
        content: 'Partial',
        errorMessage: 'the model ran out of memory',
      });
    } finally {
      stub.stop();
    }
  });

  it('treats a stream that stops early as a failure', async () => {
    const stub = useStub({ chunks: truncatedStream });

    try {
      const events = await readEvents(
        await post({ modelId: 'stub/model', text: 'hi' }),
      );

      expect(events.at(-1)?.type).toBe('error');
    } finally {
      stub.stop();
    }
  });

  it('records an interrupted turn when the caller goes away', async () => {
    const stub = useStub({ chunks: slowStream, delayMs: 40 });
    const controller = new AbortController();

    try {
      const response = await post(
        { modelId: 'stub/model', text: 'hi' },
        controller.signal,
      );
      let conversationId = 'none';

      const events = await readEvents(response, (event) => {
        if (event.type === 'start') {
          conversationId = event.conversationId;
        }

        if (event.type === 'delta') {
          controller.abort();
        }
      });

      expect(events.some((event) => event.type === 'end')).toBe(false);

      const [, assistant] = await readMessages(conversationId);

      expect(assistant.status).toBe('aborted');
      expect(assistant.content.length).toBeGreaterThan(0);
    } finally {
      stub.stop();
    }
  });

  it('stops generating when the browser cancels the turn', async () => {
    const stub = useStub({ chunks: slowStream, delayMs: 40 });

    try {
      const response = await post({ modelId: 'stub/model', text: 'hi' });
      let conversationId = 'none';
      let assistantMessageId = '';

      const events = await readEvents(response, (event) => {
        if (event.type === 'start') {
          conversationId = event.conversationId;
          assistantMessageId = event.assistantMessageId;
        }

        if (event.type === 'delta') {
          void cancel(assistantMessageId);
        }
      });

      expect(events.some((event) => event.type === 'end')).toBe(false);

      const [, assistant] = await readMessages(conversationId);

      expect(assistant.status).toBe('aborted');
      expect(assistant.content).not.toBe('one two three four five');
    } finally {
      stub.stop();
    }
  });

  it('treats cancelling a finished turn as a no-op', async () => {
    const response = await cancel('not-running');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cancelled: false });
  });

  it('answers 502 and starts no assistant turn when the server rejects', async () => {
    const stub = useStub({ chatStatus: 500, chatBody: 'model not found' });
    const conversationId = await startConversation('rejected', 'stub/model');

    try {
      const response = await post({
        conversationId,
        modelId: 'stub/model',
        text: 'hi',
      });

      expect(response.status).toBe(502);
      expect((await response.json()).error).toContain('model not found');

      const messages = await readMessages(conversationId);

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
    } finally {
      stub.stop();
    }
  });

  it('names the endpoint when the server is not running', async () => {
    const stub = useStub({});
    const url = stub.url;

    stub.stop();

    const response = await post({ modelId: 'stub/model', text: 'hi' });

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain(url);
  });

  it('rejects a request with neither text nor images', async () => {
    const response = await post({ modelId: 'stub/model', text: '  ' });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      'Send some text or at least one image.',
    );
  });

  it('reports an unknown conversation', async () => {
    const stub = useStub({ chunks: contentOnlyStream });

    try {
      const response = await post({
        conversationId: 'missing',
        modelId: 'stub/model',
        text: 'hi',
      });

      expect(response.status).toBe(404);
    } finally {
      stub.stop();
    }
  });

  it('sends images from the newest turn only', async () => {
    const stub = useStub({ chunks: contentOnlyStream });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

    try {
      const first = await readEvents(
        await post({
          modelId: 'stub/model',
          text: 'what is this?',
          attachments: [{ mimeType: 'image/png', dataBase64: png }],
        }),
      );
      const start = first[0];
      const conversationId =
        start.type === 'start' ? start.conversationId : 'none';

      await readEvents(
        await post({
          conversationId,
          modelId: 'stub/model',
          text: 'and now?',
        }),
      );

      const second = stub.received[1] as {
        messages: { role: string; content: unknown }[];
      };
      const parts = second.messages.flatMap((message) =>
        Array.isArray(message.content) ? message.content : [],
      );

      expect(parts).toHaveLength(0);
      expect(second.messages[0].content).toContain(
        '[1 image was attached to this message and is not included in this request.]',
      );
    } finally {
      stub.stop();
    }
  });
});
