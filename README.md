# vlm-chat

A chat client for a vision-language model running on your own machine. Text and
images go to a local MLX inference server; replies stream back and the whole
conversation is kept in SQLite.

The point of the repository is the boundary. The model runs in its own process,
started by hand, and the web app reaches it only over an OpenAI-compatible HTTP
API. Nothing in `src/` loads a model, and nothing in `inference/` knows the app
exists.

```text
inference/            a uv project that pins mlx-vlm and holds no source code
  ↑ OpenAI-compatible HTTP on 127.0.0.1:8080
src/lib/inference/    the only code that talks to that port
  ↑
src/app/api/chat      relays the stream and records the turn
  ↑ same-origin server-sent events
src/app/_components   the browser client
```

The browser never contacts port 8080. The Content-Security-Policy in
`next.config.ts` has no `connect-src`, so it inherits `default-src 'self'` and a
direct call would be blocked. The Next server is the only client of the model.

## Requirements

- Apple silicon, which is what MLX runs on
- Bun 1.3.14
- uv for the inference project, plus just and jq to drive it

## Setup

```bash
bun run setup
cd inference && just sync
```

`bun run setup` installs dependencies and Playwright browsers. The inference
project resolves its own Python and pins mlx-vlm to one release.

Models are whatever sits in the local HuggingFace cache:

```bash
cd inference && just download mlx-community/Qwen3-VL-4B-Instruct-4bit
```

## Run

Two processes, started separately.

```bash
cd inference && just serve
bun run dev
```

The application is available at http://localhost:3000. `bun run dev` applies any
pending migrations first, so a fresh clone needs nothing else.

`just` lists everything the inference side can do — `health` and `models` report
what the server sees, `unload` releases the loaded model, and `ask` checks
generation without going through the app.

The server binds `127.0.0.1` deliberately: mlx-vlm defaults to `0.0.0.0` with
open CORS, which would publish your local models to the whole network. It is
also started without `--model`, so it loads whichever model a request names. The
first request for a model can take tens of seconds while its weights are read
from disk.

## Configuration

There is one setting, and it has a working default:

```dotenv
VLM_CHAT_INFERENCE_URL="http://127.0.0.1:8080"
```

Set it in `.env` only to reach a server on another host or port. The database is
local SQLite at `data/dev.db`; that path is not configurable, because supporting
one database is the whole point of the choice. `DATABASE_URL` overrides it, and
exists so the tests can run against their own file: a temporary one for the
integration suite, `data/system-test.db` for the browser suite.

## Behaviour worth knowing

The model list is read from the server's `/v1/models`, which reports every MLX
model in the local HuggingFace cache. The app holds no list of its own, so a
text-only model can be selected; sending it an image fails, and the server's
own message is shown.

Only one model stays loaded. Choosing a different one unloads the previous one,
so switching mid-conversation costs a reload.

Images are sent for the newest turn only. The server collects images from every
user message, flattens them into one list, and hands the count to the chat
template, which then places that many image tokens by its own rule — so
replaying older images misplaces them. Earlier turns are sent as text with a
sentence stating that images were attached. Nothing is deleted: the images stay
in the database and stay visible in the transcript.

Thinking is decided by which model you pick, not by a setting. A thinking
template opens its own reasoning block, which is what makes the server return
`reasoning_content` separately from `content`; the app renders that in a
collapsible panel and never parses `<think>` tags. The app does not send
`enable_thinking`, because the model list is arbitrary and the field's effect on
an unknown template cannot be predicted. Starting the server with
`--enable-thinking` — `just serve-thinking` — changes its default without
affecting the app.

A seed is drawn per request. Without one the server uses 0, and identical
prompts return identical text even above temperature 0. The seed is stored on
the turn it produced.

A conversation generates one reply at a time. A second request for the same
conversation is refused with 409 rather than queued, because its prompt would
otherwise be built from a history that is missing the reply still arriving. Stop
the running turn, or wait for it. Different conversations are free to overlap,
though the server itself runs a single worker and will serialise them.

Stopping a turn works from the moment it is sent, including the long wait while
a model is read off disk. The browser names the turn with an id it chose itself,
so there is nothing to wait for before it can say stop.

## Database

Local SQLite through Prisma. `bun run dev` applies migrations already; these are
for changing the schema and for looking at what is stored.

```bash
bun run db:migrate -- --name migration-name
bun run db:reset
bun run db:studio
```

## Quality

```bash
bun run fix
bun run check
bun test
bun run test:system
bun run build
```

Unit tests live beside their owning modules. Cross-boundary tests live under
`tests/integration`, and browser-level contracts live under `tests/system`.
Neither tier needs a running model: both drive a stub that speaks the same HTTP
contract, which is also why the suite passes on Linux CI where MLX cannot run.

## Structure

- `src/app` owns route and rendering boundaries, including the API routes.
- `src/features` owns application behavior and persistence orchestration.
- `src/lib` owns environment and infrastructure connections.
- `inference` pins the inference server and contains no source code; its
  `justfile` is where that side is operated from.
