# Security notes

Sessions use random opaque tokens in `HttpOnly`, `SameSite=Lax` cookies with `Secure` in production. Only HMAC-SHA-256 token digests are stored, keyed by `SESSION_SECRET`. Passwords use Argon2. Session expiry is seven days. Mutations require an `X-CSRF-Token` matching the session or guest CSRF cookie and reject an unexpected `Origin`.

Fastify rate limits all requests, with tighter limits for login, registration, and checkout. Shared Zod contracts validate mutation bodies. Catalog, fulfillment, and administrator routes re-check the role on the server. A catalog role cannot fulfill orders; a fulfillment role cannot edit products or promotions. Audit events record sensitive changes.

Checkout accepts only variant IDs and quantities. It locks variant rows, calculates final prices and discounts from PostgreSQL, atomically claims stock, and records a simulated payment in the same transaction. The idempotency lock prevents duplicate orders under concurrent retries. Cancellation locks the order and restores stock exactly once. Guest order tracking uses a random token whose hash is stored in the order; the order UUID alone is insufficient.

Secrets belong in environment variables. `.env` is ignored. Never use the sample database password or seed admin password in a public deployment. Serve the web and API behind HTTPS, set exact `WEB_ORIGIN`, and keep PostgreSQL private. Configure a reverse proxy with suitable CSP, Referrer-Policy, and request size limits for production. Review outbound image domains and replace remote catalog images with owned storage before launching a real store.

This is a demonstration checkout. It does not implement card processing, tax reporting, or financial reconciliation.
