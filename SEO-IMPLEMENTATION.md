# Technical SEO implementation

## Business and indexing decisions

- Canonical origin: **https://vunjabeiliquorzanzibar.co.tz** (non-www, matching the supplied domain). `proxy.ts` redirects the www host with HTTP 301 and preserves path/query. Both DNS names and TLS certificates must reach the same deployment.
- Public business name: **Vunjabei Liquor Zanzibar**, alternate name **Nungwi Shop**, as confirmed by the owner. Both names also appear in the visible footer.
- Content targets drinks/liquor delivery in Zanzibar, Nungwi and Kendwa, including hotel/villa guests and local customers. Delivery copy does not claim service throughout all Zanzibar or promise unverified delivery times.
- Public indexable URLs: home, shop, help, active product pages, and categories with active products. Account, authentication, checkout, hotel, ERP/admin, API and token-based delivery routes are excluded from the sitemap and marked noindex.
- EN/SW currently shares the same URLs and uses browser state/localStorage. No separate indexable translations exist, so **no hreflang** is emitted. Adding `/en/` and `/sw/` would require separately rendered translated content and reciprocal alternate links.
- Organization JSON-LD is emitted using verified configured contact details. It becomes LiquorStore/LocalBusiness only when a real `SHOP_STREET_ADDRESS` is configured. No address, map coordinates, opening hours, ratings, reviews, GTINs or social profiles have been invented.

## Implemented behavior

Each existing page has a Metadata API title, description, canonical, Open Graph and Twitter metadata. Product/category metadata is database-driven. Metadata base uses the production origin even on local previews. A 1200×630 `next/og` image is available at `/og`; `/og?product=ID` uses that product's name and public price.

Product pages have Product/Offer and BreadcrumbList JSON-LD. Listings have ItemList entries with product data and links. Prices and stock use public retail values and respect selling-unit conversion and minimum quantities. Purchase costs and hotel-specific prices are not serialized. JSON-LD escapes HTML-significant characters to prevent a catalogue name from breaking out of its script tag.

Public pages render catalogue content in the initial HTML and use a 60-second revalidation interval (the first request after expiry can receive stale content while regeneration runs). The client refreshes catalogue data and cart/checkout operations continue to validate live prices and stock. The sitemap reads active products/categories at request time, fails visibly if the database is unavailable, and does not invent last-modified dates.

All former raw image tags now use the shared next/image component, with dimensions or fill/sizes, descriptive alternative text, hero preloading, and default lazy loading. Local raster images are optimized. SVG/data/blob images and unapproved remote hosts retain direct loading; add verified HTTPS hosts to `NEXT_PUBLIC_IMAGE_HOSTS` and rebuild to optimize their images. Arbitrary remote optimization is deliberately not enabled. Uploaded product images use the crawlable optimizer URL in Product schema because the requested robots baseline excludes raw `/uploads/` URLs.

Roboto and Libre Caslon Text are self-hosted through next/font with swap behavior. Raw Google Fonts link tags are removed. The initial startup overlay is removed, the route loading fallback is lightweight, hero entrance animation no longer delays the main content, and SweetAlert is loaded on interaction.

## Verification and limitations

- Production build: `node node_modules/next/dist/bin/next build --webpack`. Webpack is used because Turbopack stalled in this local environment during earlier work.
- Unit/integration suite: **60 tests passed**, including six SEO tests. Database tests use isolated schemas.
- `python scripts/check-seo.py` checks production HTML, canonical URLs, distinct page titles, one H1, structured-data fields, private-route authentication/noindex, robots/sitemap, the 301 redirect and social-image dimensions. Evidence: `design/seo-verification.json`.
- The five URLs in the recorded sitemap reflect the current database (three static public pages, one active product, one category). Future active catalogue records are included automatically.
- `/checkout`, `/customer`, `/dashboard` and `/hotel` call the existing server-side `pageUser` guard. With App Router streaming they can return HTTP 200 containing a server-issued login refresh instead of an initial 307; no protected page content is rendered. Robots and noindex do not replace these guards.
- Google Rich Results required Product/Offer/Breadcrumb fields are checked locally. **Google's hosted Rich Results Test has not been certified as passing**; run it on the deployed product URL after release. Valid markup does not guarantee rich-result eligibility or display, and list pages are not substitutes for single-product rich results.
- The first live `/robots.txt` check returned **404**. The latest saved live checks returned **503 Service Unavailable for both robots and sitemap** (`design/seo-live-robots.txt`, `design/seo-live-sitemap.txt`). Local production checks return **200** (`design/seo-local-robots.txt`, `design/seo-local-sitemap.txt`). No deployment was performed in this task; live success remains unverified.
- `python design/check-seo-browser.py` passed on the final production build: desktop/mobile layouts, locally served fonts, optimized product images, product-to-shop purchase links, and logged-out browser redirects. The only browser errors were the existing Vercel Analytics script returning 404 on a non-Vercel local server; no new page errors were observed.

## Lighthouse

The saved reports audit the homepage on the same localhost production URL with Lighthouse 13.5.0, default mobile simulation, and Performance/SEO categories. They are lab measurements on this workstation, not field Core Web Vitals. Machine load, cold image transforms and caching can affect results.

| Run | Performance | SEO | LCP | TBT | CLS |
| --- | ---: | ---: | --- | --- | --- |
| Before | 58 | 100 | 15.7 s | 560 ms | 0 |
| Intermediate, before caching/JS improvements | 41 | 100 | 5.4 s | 2,700 ms | 0 |
| Final | 74 | 100 | 3.4 s | 710 ms | 0 |

Final values are recorded in `design/lighthouse-after.report.json` and its HTML companion (2026-09-22T23:59:04Z). First contentful paint improved from 2.0 s to 1.1 s. Mobile blocking time remains an optimization opportunity and is higher than the baseline despite the overall improvement. The intermediate result is retained rather than hidden. An SEO score of 100 only covers Lighthouse's basic checks; it is not proof of complete SEO coverage. The final audit used a warmed production server after smoke checks; these are single-run comparisons, not a statistical benchmark.

## Manual release checklist

1. Deploy this build with working PostgreSQL access, writable Next image/cache storage and the configured upload directory. Initial build requires access to Google Fonts; font files are then served locally to browsers.
2. Point both the non-www and www domains at the deployment, provision TLS for both, and verify the 301 from www. Non-www is already selected; no further host choice is required.
3. Set `APP_URL=https://vunjabeiliquorzanzibar.co.tz` in production for authentication/payment link generation. Canonical SEO URLs are fixed to that host in `lib/seo.ts`.
4. Confirm public phone/email/hours and supply the real street address and coordinates if this is a physical shop. Optional structured hours use `SHOP_OPENING_HOURS`, for example `Mo-Sa 09:00-22:00;Su 10:00-20:00`. Keep them consistent with visible `SHOP_HOURS` / `SHOP_HOURS_SW`.
5. Verify Google Search Console ownership. A **Domain property uses a DNS TXT record**; alternatively, set `GOOGLE_SITE_VERIFICATION` for the HTML meta tag on a URL-prefix property and rebuild. No verification token was fabricated.
6. Verify live robots and sitemap with the commands below, then submit `/sitemap.xml` in Search Console. Inspect a product URL and run Google's Rich Results Test.
7. Supply the GA4 Measurement ID (`G-...`) and the desired consent behavior before enabling tracking. `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is a documented placeholder only; **no GA4 tracking was automatically configured**. Existing Vercel Analytics behavior is unchanged.
8. Run production PageSpeed Insights/Lighthouse after deployment and monitor field Core Web Vitals in Search Console.
9. Review real catalogue photography before submitting product URLs. The current K-Vant record displays an uploaded barcode photo rather than a clear product photo; this existing business record was not changed during the SEO work.

```powershell
curl.exe -i https://vunjabeiliquorzanzibar.co.tz/robots.txt
curl.exe -i https://vunjabeiliquorzanzibar.co.tz/sitemap.xml
curl.exe -I https://www.vunjabeiliquorzanzibar.co.tz/shop
```

## Every changed application/configuration file

| File | Change |
| --- | --- |
| `.env.example` | Verified business fields, permitted image hosts, GSC token and inactive GA4 placeholder. |
| `app/layout.tsx` | Root metadata/base URL, OG/Twitter defaults, optional GSC verification, business JSON-LD, next/font and removal of startup overlay. |
| `app/page.tsx` | Homepage metadata and public catalogue rendered on the server with 60-second revalidation. |
| `app/shop/page.tsx` | Shop metadata, catalogue server rendering, ItemList and breadcrumbs. |
| `app/help/page.tsx` | Server wrapper enabling help metadata and breadcrumbs. |
| `app/products/[id]/page.tsx` | New public product details, metadata, price/stock, Product/Offer, breadcrumbs and purchase link. |
| `app/categories/[category]/page.tsx` | New public category pages with product links, metadata, ItemList and breadcrumbs. |
| `app/og/route.tsx` | New generic/product-specific 1200×630 social images. |
| `app/robots.ts` | Typed generated crawl rules and sitemap link. |
| `app/sitemap.ts` | Typed dynamic public URL sitemap. |
| `app/loading.tsx` | Lightweight route-loading fallback. |
| `app/auth/page.tsx` | Unique canonical metadata and noindex. |
| `app/login/page.tsx` | Unique canonical metadata and noindex. |
| `app/signup/page.tsx` | Unique canonical metadata and noindex. |
| `app/forgot-password/page.tsx` | Unique canonical metadata, noindex and no-referrer. |
| `app/reset-password/page.tsx` | Unique canonical metadata, noindex and no-referrer. |
| `app/accept-invitation/page.tsx` | Unique canonical metadata, noindex and no-referrer. |
| `app/checkout/page.tsx` | Unique canonical metadata/noindex; existing server auth retained. |
| `app/customer/page.tsx` | Unique canonical metadata/noindex; existing server auth retained. |
| `app/dashboard/page.tsx` | Unique canonical metadata/noindex; existing staff guard retained. |
| `app/hotel/page.tsx` | Unique canonical metadata/noindex; existing hotel guard retained. |
| `app/delivery/[token]/page.tsx` | Private delivery metadata; avoids exposing the secret token in the canonical. |
| `app/auth/auth-page.tsx` | Optimized hero and one descriptive form H1. |
| `app/auth/set-password.tsx` | Main form heading promoted to H1. |
| `app/auth/auth.module.css` | Font variables and matching heading selectors. |
| `app/dashboard/dashboard.module.css` | Self-hosted font variable. |
| `app/classic.css` | Self-hosted font variables, new product/category layouts and lightweight loading style. |
| `components/catalogue-shell.tsx` | Shared accessible public catalogue page header/footer. |
| `components/help-page.tsx` | Extracted translated interactive help content with descriptive H1. |
| `components/json-ld.tsx` | Shared safely serialized structured-data script. |
| `components/site-image.tsx` | Shared next/image optimization, sizing and image-error fallback. |
| `components/storefront.tsx` | Server catalogue props, descriptive headings, crawlable product links, optimized images and product deep-link dialog. |
| `components/shop-categories.tsx` | Optimized category images and crawlable category links. |
| `components/shop-footer.tsx` | Visible association of both business names. |
| `components/checkout-flow.tsx` | Optimized, named basket images. |
| `components/platform.tsx` | Optimized admin/customer product images. |
| `components/platform-form.tsx` | Sized next/image preview. |
| `components/scanner/label-printer.tsx` | Sized next/image QR display. |
| `components/scanner/scan-modal.tsx` | Sized next/image scanned-product thumbnail. |
| `components/site-motion.tsx` | Removed hero/intro entrance animations from the critical rendering path. |
| `components/use-alerts.ts` | Load SweetAlert only when an alert is requested. |
| `lib/catalogue-client.ts` | Accept server catalogue data while retaining live client refresh. |
| `lib/seo.ts` | Shared canonical URLs, metadata, breadcrumbs and safe JSON-LD serialization. |
| `lib/server/seo.ts` | Public-only catalogue projection, business and product/list schemas. |
| `next.config.mjs` | Image optimization allowlists and private-route X-Robots-Tag headers. |
| `proxy.ts` | Canonical-host 301 redirect. |
| `tests/seo.test.ts` | Metadata, redirect, offer availability, robots and JSON-LD safety tests. |
| `scripts/check-seo.py` | Repeatable read-only production SEO verification. |
| `design/check-seo-browser.py` | Read-only browser checks and desktop/mobile evidence capture. |
| `SEO-IMPLEMENTATION.md` | This implementation inventory and release guide. |

Audit/evidence files: `design/lighthouse-before.report.{html,json}`, `design/lighthouse-intermediate.report.{html,json}`, `design/lighthouse-after.report.{html,json}`, `design/seo-verification.json`, `design/seo-product-og.png`, `design/seo-{home,shop,help,login,product}-{desktop,mobile}.png`, `design/seo-browser-verification.txt`, and `design/seo-{local,live}-{robots,sitemap}.txt`.

References: [Google robots guidance](https://developers.google.com/search/docs/crawling-indexing/robots/intro), [Product structured data requirements](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), [Google Rich Results Test](https://search.google.com/test/rich-results). Next.js behavior was checked against this installed version's documentation in `node_modules/next/dist/docs/`.
