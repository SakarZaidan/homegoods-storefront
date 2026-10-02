# API guide

Base URL: `/v1`. JSON request and response bodies use English field names; product text has `En` and `Ar` fields. KWD amounts are integer **fils**. The public OpenAPI document is served at `/openapi.json`; a tracked contract summary is in [openapi.yaml](openapi.yaml).

| Area | Routes | Access |
| --- | --- | --- |
| Auth | `GET /auth/session`, `POST /auth/register`, `/login`, `/logout` | Public or signed in |
| Catalog | `GET /catalog/categories`, `/collections`, `/products`, `/products/:slug` | Public |
| Cart | `POST /cart/quote` | Public |
| Checkout | `POST /checkout` | Public with CSRF token |
| Orders | `GET /orders`, `/orders/:id` | Account or guest tracking token |
| Studio | `/admin/overview`, `/products`, `/variants`, `/inventory/adjust`, `/orders`, `/promotions`, `/audit`, `/catalog.csv`, `/catalog/import` | Role restricted |
| Events | `GET /events/inventory` | Public SSE |

Call `GET /auth/session` before a mutation and send its `csrfToken` as `X-CSRF-Token`, with cookies. Guest checkout needs a UUID `idempotencyKey`. The response includes an order and a one-time guest tracking token. Repeat requests with the same key return the existing order. The tracking token is required to read a guest order unless the authenticated account owns it.

`POST /cart/quote` accepts `{ items: [{ variantId, quantity }], promotionCode? }`; it returns current lines, totals, stock, and applied promotion. `POST /checkout` adds customer name, email, phone, address, and idempotency key. Delivery costs 3 KWD below 50 KWD after discount, otherwise it is complimentary. `WELCOME10` is seeded as an example promotion.

The catalog supports `q`, `category`, `collection`, `sort=price-asc|price-desc`, `featured=true`, and `page`. Studio CSV export includes product and variant columns. Import accepts parsed rows of `sku`, `priceFils`, and `stock` from the studio UI.
