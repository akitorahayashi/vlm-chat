<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# vlm-chat

The inference server is a separate process running stock `mlx_vlm.server`; no
Python source belongs in this repository. `src/lib/inference/` is the only code
that may call it, and `inference/justfile` is where that server is operated
from — do not add npm scripts that wrap it.

## Constraints of that server

- `image_url.url` resolves http(s) URLs and local filesystem paths. The upload
  schema therefore accepts `{ mimeType, dataBase64 }` and never a URL. Do not
  add a "paste an image URL" field: it would make the machine running the model
  an SSRF and arbitrary-file-read target.
- Images are collected from every user message, flattened, and counted into
  `num_images` for the chat template. Send image parts for the newest user turn
  only; `src/features/completion/messages.ts` owns that rule.
- `seed` defaults to 0, so a request without one is deterministic. One is drawn
  per request and stored on the turn.
- One model stays loaded; naming a different one unloads the previous one.
- Failures after generation starts arrive as `data: {"error": ...}` inside a 200
  response, so payloads must be inspected rather than status codes alone.
- The default bind address is `0.0.0.0` with open CORS. Start it on
  `127.0.0.1`.

## Repository constraints

- `src/app/api/**/route.ts` must not import from `next/*` at runtime, only as
  types. The integration tests call these handlers directly.
- `await connection()` at the top of every page is load-bearing: without it the
  route is prerendered at build time against an unmigrated database.
- The CSP allows `img-src 'self' data:`. Image previews use data URLs and stored
  images are served from `/api/attachments/<id>`; `blob:` will not render.
- Tests must never require a live inference server. Both stubs live in
  `tests/integration/fixtures/` and `tests/system/fixtures/`.
