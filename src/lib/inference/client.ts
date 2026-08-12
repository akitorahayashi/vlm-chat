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

export async function fetchModelIds(signal?: AbortSignal) {
  const { response, endpoint } = await request('/v1/models', { signal });
  const parsed = modelListSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error(
      `The inference server at ${endpoint} returned an unrecognized model list.`,
    );
  }

  return parsed.data.data.map((model) => model.id);
}
