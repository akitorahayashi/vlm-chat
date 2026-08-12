type RawEnv = Record<string, string | undefined>;

/**
 * The database is local SQLite and nothing else, so its location is an
 * implementation detail rather than something to configure. `DATABASE_URL`
 * exists only so the integration tests can point at a temporary file.
 */
const LOCAL_DATABASE_URL = 'file:./data/dev.db';

/** Where `mlx_vlm.server` listens by default. */
const LOCAL_INFERENCE_URL = 'http://127.0.0.1:8080';

export function getDatabaseUrl(raw: RawEnv = process.env) {
  const override = raw.DATABASE_URL;

  if (override === undefined || override === '') {
    return LOCAL_DATABASE_URL;
  }

  if (!override.startsWith('file:') && !override.startsWith('sqlite:')) {
    throw new Error('DATABASE_URL must use file: or sqlite:.');
  }

  return override;
}

export function getInferenceEndpoint(raw: RawEnv = process.env) {
  const configured = raw.VLM_CHAT_INFERENCE_URL;

  if (configured === undefined || configured === '') {
    return LOCAL_INFERENCE_URL;
  }

  const endpoint = configured.replace(/\/+$/, '');

  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    throw new Error('VLM_CHAT_INFERENCE_URL must use http:// or https://.');
  }

  return endpoint;
}
