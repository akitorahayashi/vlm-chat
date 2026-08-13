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
import { useInferenceStub } from './fixtures/inference-stub';

let completionCounter = 0;

function nextCompletionId() {
  completionCounter += 1;

  return `test-${completionCounter}`;
}

async function post(body: Record<string, unknown>, signal?: AbortSignal) {
  const { POST } = await import('@/app/api/chat/route');

  return POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completionId: nextCompletionId(), ...body }),
      signal,
    }),
  );
}

async function removeConversation(conversationId: string) {
  const { DELETE } = await import(
    '@/app/api/conversations/[conversationId]/route'
  );

  return DELETE(
    new Request(`http://localhost/api/conversations/${conversationId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ conversationId }) },
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

async function cancel(completionId: string) {
  const { DELETE } = await import('@/app/api/completions/[completionId]/route');

  return DELETE(
    new Request(`http://localhost/api/completions/${completionId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ completionId }) },
  );
}

function conversationIdOf(events: ChatEvent[]) {
  const start = events.find((event) => event.type === 'start');

  if (!start) {
    throw new Error('The chat route sent no start event.');
  }

  return start.conversationId;
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
    const stub = useInferenceStub({ chunks: contentOnlyStream });

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

      const conversationId = conversationIdOf(events);
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
    const stub = useInferenceStub({ chunks: reasoningThenContentStream });

    try {
      const events = await readEvents(
        await post({ modelId: 'stub/model', text: 'colour?' }),
      );
      const conversationId = conversationIdOf(events);
      const [, assistant] = await readMessages(conversationId);

      expect(assistant.content).toBe('Blue.');
      expect(assistant.reasoning).toBe('weighing options');
    } finally {
      stub.stop();
    }
  });

  it('does not send enable_thinking upstream', async () => {
    const stub = useInferenceStub({ chunks: contentOnlyStream });

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
    const stub = useInferenceStub({ chunks: midStreamErrorStream });

    try {
      const events = await readEvents(
        await post({ modelId: 'stub/model', text: 'hi' }),
      );
      expect(events.at(-1)).toEqual({
        type: 'error',
        message: 'the model ran out of memory',
      });

      const conversationId = conversationIdOf(events);
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
    const stub = useInferenceStub({ chunks: truncatedStream });

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
    const stub = useInferenceStub({ chunks: slowStream, delayMs: 40 });
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
    const stub = useInferenceStub({ chunks: slowStream, delayMs: 40 });
    const completionId = 'cancel-mid-stream';

    try {
      const response = await post({
        completionId,
        modelId: 'stub/model',
        text: 'hi',
      });
      let conversationId = 'none';

      const events = await readEvents(response, (event) => {
        if (event.type === 'start') {
          conversationId = event.conversationId;
        }

        if (event.type === 'delta') {
          void cancel(completionId);
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

  it('stops a turn that is still waiting for the model to load', async () => {
    // Nothing has been streamed yet and no assistant row exists, so the id the
    // client chose is the only thing that can name the turn.
    const stub = useInferenceStub({
      chunks: contentOnlyStream,
      headerDelayMs: 500,
    });
    const completionId = 'cancel-before-start';

    try {
      const pending = post({
        completionId,
        modelId: 'stub/model',
        text: 'hi',
      });

      await Bun.sleep(80);

      expect(await (await cancel(completionId)).json()).toEqual({
        cancelled: true,
      });
      expect((await pending).status).toBe(499);
    } finally {
      stub.stop();
    }
  });

  it('refuses a second turn while the conversation is still generating', async () => {
    const stub = useInferenceStub({ chunks: slowStream, delayMs: 30 });
    const conversationId = await startConversation('busy', 'stub/model');

    try {
      const first = await post({
        conversationId,
        modelId: 'stub/model',
        text: 'one',
      });
      const second = await post({
        conversationId,
        modelId: 'stub/model',
        text: 'two',
      });

      expect(second.status).toBe(409);
      expect(await second.json()).toMatchObject({ conversationId });

      // The refused request must not have stored its message either, or the
      // next prompt would carry a turn the model never answered.
      expect(await readMessages(conversationId)).toHaveLength(2);

      await readEvents(first);

      const messages = await readMessages(conversationId);

      expect(messages).toHaveLength(2);
      expect(messages[1].status).toBe('complete');

      // Once it has settled the conversation accepts turns again.
      const third = await post({
        conversationId,
        modelId: 'stub/model',
        text: 'three',
      });

      expect(third.status).toBe(200);
      await readEvents(third);
    } finally {
      stub.stop();
    }
  });

  it('releases a conversation whose stream was never read', async () => {
    const stub = useInferenceStub({ chunks: slowStream, delayMs: 30 });
    const conversationId = await startConversation('abandoned', 'stub/model');

    try {
      const response = await post({
        conversationId,
        modelId: 'stub/model',
        text: 'one',
      });

      // Cancelling without reading is what a browser that disconnects while the
      // first event is in flight does. The claim has to come back from that path
      // too, or the conversation answers 409 for the life of the process.
      await response.body?.cancel();

      const [, assistant] = await readMessages(conversationId);

      expect(assistant.status).toBe('aborted');

      const second = await post({
        conversationId,
        modelId: 'stub/model',
        text: 'two',
      });

      expect(second.status).toBe(200);
      await readEvents(second);
    } finally {
      stub.stop();
    }
  });

  it('survives the conversation being deleted mid-stream', async () => {
    const stub = useInferenceStub({ chunks: slowStream, delayMs: 30 });
    const conversationId = await startConversation('deleted', 'stub/model');

    try {
      const response = await post({
        conversationId,
        modelId: 'stub/model',
        text: 'hi',
      });

      await readEvents(response, (event) => {
        if (event.type === 'delta') {
          void removeConversation(conversationId);
        }
      });

      const { prisma } = await import('@/lib/prisma');

      expect(await prisma.message.count({ where: { conversationId } })).toBe(0);

      // The lock has to come back with it, or the id would stay busy forever.
      expect(
        await post({ conversationId, modelId: 'stub/model', text: 'again' }),
      ).toMatchObject({ status: 404 });
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
    const stub = useInferenceStub({
      chatStatus: 500,
      chatBody: 'model not found',
    });
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

  it('names the conversation it created even when the turn is rejected', async () => {
    // A first message is stored in a conversation the caller has not seen yet.
    // Without the id in the rejection, a retry would open a second one and
    // abandon this message.
    const stub = useInferenceStub({
      chatStatus: 500,
      chatBody: 'model not found',
    });

    try {
      const rejection = await post({ modelId: 'stub/model', text: 'first' });
      const { conversationId } = await rejection.json();

      expect(rejection.status).toBe(502);
      expect(typeof conversationId).toBe('string');

      const messages = await readMessages(conversationId);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('first');
    } finally {
      stub.stop();
    }
  });

  it('continues the same conversation when a rejected turn is retried', async () => {
    const failing = useInferenceStub({
      chatStatus: 500,
      chatBody: 'model not found',
    });
    let conversationId: string;

    try {
      const rejection = await post({ modelId: 'stub/model', text: 'first' });
      conversationId = (await rejection.json()).conversationId;
    } finally {
      failing.stop();
    }

    const working = useInferenceStub({ chunks: contentOnlyStream });

    try {
      const events = await readEvents(
        await post({ conversationId, modelId: 'stub/model', text: 'again' }),
      );
      const start = events[0];

      expect(start.type === 'start' && start.conversationId).toBe(
        conversationId,
      );

      const { prisma } = await import('@/lib/prisma');

      expect(
        await prisma.conversation.count({ where: { id: conversationId } }),
      ).toBe(1);
      expect(await readMessages(conversationId)).toHaveLength(3);
    } finally {
      working.stop();
    }
  });

  it('names the endpoint when the server is not running', async () => {
    const stub = useInferenceStub({});
    const url = stub.url;

    stub.stopServer();

    try {
      const response = await post({ modelId: 'stub/model', text: 'hi' });

      expect(response.status).toBe(502);
      expect((await response.json()).error).toContain(url);
    } finally {
      stub.stop();
    }
  });

  it('rejects a request with neither text nor images', async () => {
    const response = await post({ modelId: 'stub/model', text: '  ' });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      'Send some text or at least one image.',
    );
  });

  it('reports an unknown conversation', async () => {
    const stub = useInferenceStub({ chunks: contentOnlyStream });

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
    const stub = useInferenceStub({ chunks: contentOnlyStream });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

    try {
      const first = await readEvents(
        await post({
          modelId: 'stub/model',
          text: 'what is this?',
          attachments: [{ mimeType: 'image/png', dataBase64: png }],
        }),
      );
      const conversationId = conversationIdOf(first);

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
