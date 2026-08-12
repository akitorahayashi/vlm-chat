# next-bun

`next-bun` is a minimal full-stack Next.js starter for Bun. It includes a
database-backed Hello World page, a local SQLite workflow, and a Turso runtime
configuration through the same Prisma boundary.

## Requirements

- Bun 1.3.14

## Setup

The setup command creates `.env`, installs dependencies and Playwright browsers,
applies local migrations, and seeds the greeting.

```bash
bun run setup
bun run dev
```

The application is available at http://localhost:3000.

## Database

Local development uses SQLite by default.

```dotenv
DATABASE_URL="file:./data/dev.db"
TURSO_AUTH_TOKEN=""
```

The local database commands are:

```bash
bun run db:setup
bun run db:migrate -- --name migration-name
bun run db:seed
bun run db:reset
bun run db:studio
```

Turso uses the same Prisma client with a remote URL and token.

```dotenv
DATABASE_URL="libsql://database-name.turso.io"
TURSO_AUTH_TOKEN="token"
```

Pending migrations, seed data, and connectivity are managed explicitly.

```bash
bun run turso:migrate
bun run db:seed
bun run turso:health
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

## Structure

- `src/app` owns route and rendering boundaries.
- `src/features` owns application behavior and persistence orchestration.
- `src/lib` owns environment and infrastructure connections.
