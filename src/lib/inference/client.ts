import { isAbortError } from '../abort-error';
import { getInferenceEndpoint } from '../environment';
import { describeInferenceFailure, describeInferenceStatus } from './failure';
import { type ChatCompletionBody, modelListSchema } from './schema';

/** The only place in the app that talks to the inference server. */
async function request(path: string, init: RequestInit) {
  const endpoint = getInferenceEndpoint();

  let response: Response;

  try {
    response = await fetch(`${endpoint}${path}`, init);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new Error(describeInferenceFailure(error, endpoint));
  }

  if (!response.ok) {
    throw new Error(
      describeInferenceStatus(response.status, await response.text(), endpoint),
    );
  }

  return { response, endpoint };
}

export async function openChatCompletion(
  body: ChatCompletionBody,
  signal?: AbortSignal,
) {
  const { response, endpoint } = await request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.body) {
    throw new Error(
      `The inference server at ${endpoint} returned no response body.`,
    );
  }

  return response.body;
}

/**
 * The model list is a scan of the local HuggingFace cache, so seconds is
 * already generous. A server that accepts the connection and never answers
 * would otherwise leave the picker loading with nothing to say. Streaming has
 * no deadline of its own: reading a model off disk legitimately takes minutes.
 */
const MODEL_LIST_TIMEOUT_MS = 5_000;

export async function fetchModelIds(signal?: AbortSignal) {
  const deadline = AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS);
  const { response, endpoint } = await request('/v1/models', {
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  }).catch((error: unknown) => {
    if (deadline.aborted && !signal?.aborted) {
      throw new Error(
        `The inference server at ${getInferenceEndpoint()} did not answer within ${MODEL_LIST_TIMEOUT_MS / 1000} seconds.`,
      );
    }

    throw error;
  });

  const parsed = modelListSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error(
      `The inference server at ${endpoint} returned an unrecognized model list.`,
    );
  }

  return parsed.data.data.map((model) => model.id);
}
