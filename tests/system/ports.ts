/**
 * Ports the browser tests run on. They belong to the test setup rather than to
 * the application's environment: nothing outside `tests/system` and
 * `playwright.config.ts` reads them, and they are chosen to stay clear of the
 * development server on 3000 and the inference server on 8080.
 */
export const APP_PORT = 3001;
export const STUB_INFERENCE_PORT = 8123;
