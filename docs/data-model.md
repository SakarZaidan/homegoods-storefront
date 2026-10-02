# Data model

| Table | Purpose |
| --- | --- |
| `categories`, `collections` | Bilingual merchandising taxonomy. |
| `products`, `product_images` | Bilingual content and ordered images. |
| `variants` | SKU, labels, authoritative price in fils, and available stock. |
| `stock_movements` | Signed inventory ledger with reason, order, and actor. |
| `inventory_events` | Durable outbox for SSE replay after commit. |
| `users`, `sessions` | Accounts, roles, token hashes, CSRF tokens, expiry. |
| `promotions` | Percentage discounts with active period. |
| `orders`, `order_items` | Customer and item snapshots, totals, status, idempotency key, one-time stock restoration flag. |
| `payments` | Explicitly simulated payment and refund status. |
| `audit_events` | Who changed catalog, inventory, orders, and promotions. |
| `email_previews` | Local transactional mail previews. |

Foreign keys preserve catalog and order relationships. Order items snapshot names, SKU, labels, quantity, and price so later edits do not rewrite purchase history. Product variants cannot be deleted while an order references them. A seeded catalog uses five categories, three collections, 125 products, and 20 variants per product for 2,500 SKUs.
