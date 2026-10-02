# Operations

## Setup and migration

Use PostgreSQL 16+, set `DATABASE_URL`, run `pnpm db:migrate`, then `pnpm db:seed`. The seed is deterministic and exits when categories already exist. To create an administrator, set `SEED_ADMIN_PASSWORD` (12+ characters) on the first seed. Never commit passwords or a filled `.env`.

## Run and monitor

The API serves `/health` and `/openapi.json`. Start API and web with `pnpm dev` for development or `pnpm build` followed by their production commands. Monitor Fastify logs, database connections, inventory events, order failures, SMTP delivery, and disk growth in `email_previews` and audit tables. SSE clients reconnect with their last event ID; keep at least enough outbox history for the expected reconnect window. The current implementation retains events indefinitely.

## Backups and recovery

Back up PostgreSQL regularly, test restores, and keep migration files with each release. Restore the whole database as one unit so stock, orders, and event history remain consistent. Run migrations before switching API traffic. Avoid editing order totals or stock directly; use adjustment endpoints so ledger and SSE remain in sync.

## Deployment

The `deploy` folder contains Dockerfile and Compose examples. Place TLS and security headers at a reverse proxy; keep API and database on private networks. Set a real `WEB_ORIGIN` and public `NEXT_PUBLIC_API_URL` before building web assets. For mail previews, leave `SMTP_HOST` empty; for SMTP, set host, port, user, password, and sender. No real payment credentials are needed.

## CI

GitHub Actions runs PostgreSQL, migrations, the seed, type checks, unit and live API tests, Next build, and desktop/mobile Playwright flows in English and Arabic. The test database and seed administrator are ephemeral.
