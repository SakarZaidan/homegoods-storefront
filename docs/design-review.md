# Design and UX review

Rubric: each category is scored from 1 (broken) to 10 (release ready). A score below 9 requires another design pass before public launch. This review covers the implemented desktop and mobile English/Arabic paths, not a production traffic study.

| Category | Score | Evidence and remaining work |
| --- | ---: | --- |
| Identity and visual consistency | 9 | Original hero and three product photographs, olive/limestone/clay palette, repeated typographic and spacing rules. Remaining seeded images use remote stock photography. |
| Shopping clarity | 9 | Collection/category discovery, search, variant stock labels, live quote, clear simulated payment notice, order tracking. |
| Responsive behavior | 9 | Header, product grid, category tiles, cart, checkout, and studio adapt under 850px and 620px. Desktop and mobile browser paths are automated. |
| Arabic and RTL | 9 | Localized primary copy and catalog content, `dir=rtl`, mirrored layout and controls, Arabic browser flow. Some studio technical labels remain English (SKU, slug, CSV). |
| Accessibility | 9 | Semantic regions, labels, button names, focus ring, live status/error regions, reduced-motion setting. Automated axe checks report no serious or critical WCAG A/AA violations on English/Arabic home, shop, and admin pages at desktop and mobile widths. A full assistive-technology audit remains a release task. |
| Performance | 9 | Static asset hero, lazy-loaded product images, 200-item catalog cap, lightweight CSS. Local Chromium measurements of fresh browser contexts showed visible home content in 638–1,014 ms and first shop card in 118–147 ms across both languages and widths. Field Core Web Vitals remain to be measured after deployment. |
| Error and empty states | 9 | Empty bag/favorites/search, admin auth and errors, preview catalog when API is unavailable. |

The preview catalog remains explicitly labeled when the API is offline. Checkout and studio actions require PostgreSQL. The 12 desktop/mobile browser cases pass locally, including the axe scans and horizontal-overflow checks. Performance measurements use `node scripts/measure-performance.mjs` against local production servers and are a development baseline, not a production traffic study or Core Web Vitals result.
