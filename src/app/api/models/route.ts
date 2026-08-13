import { describeError } from '@/lib/describe-error';
import { fetchModelIds } from '@/lib/inference/client';

export const dynamic = 'force-dynamic';

/**
 * The list is whatever the inference server reports. When it cannot be reached
 * this answers 502 with the reason rather than an empty list, so the picker can
 * say why it is empty instead of looking like no models are installed.
 */
export async function GET(request: Request) {
  try {
    return Response.json({ models: await fetchModelIds(request.signal) });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
