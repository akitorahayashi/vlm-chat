import { describe, expect, it } from 'bun:test';
import { describeInferenceFailure, describeInferenceStatus } from './failure';

const endpoint = 'http://127.0.0.1:8080';

describe('describing an inference failure', () => {
  it('names the endpoint and how to start the server when it is unreachable', () => {
    const error = new TypeError('fetch failed', {
      cause: Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      }),
    });

    const message = describeInferenceFailure(error, endpoint);

    expect(message).toContain(endpoint);
    expect(message).toContain('just serve');
  });

  it('keeps the original reason for any other failure', () => {
    expect(
      describeInferenceFailure(new Error('socket hang up'), endpoint),
    ).toContain('socket hang up');
  });

  it('quotes the upstream body on a bad status', () => {
    expect(describeInferenceStatus(500, '  boom  ', endpoint)).toBe(
      `The inference server at ${endpoint} returned 500: boom`,
    );
  });

  it('reads cleanly when the upstream body is empty', () => {
    expect(describeInferenceStatus(503, '', endpoint)).toBe(
      `The inference server at ${endpoint} returned 503.`,
    );
  });
});
