id: performance
title: Caching, performance and quotas
icon: bolt
time: 8|5|22
summary: Cache layers, page cache and remote includes, custom caches, quotas and common performance mistakes.
source: Salesforce developers: Caching strategies | https://developer.salesforce.com/docs/commerce/sfra/guide/caching-strategies-sk.html
source: Salesforce developers: Custom caches | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-custom-caches.html
source: Salesforce developers: Governance and quotas | https://developer.salesforce.com/docs/commerce/commerce-api/guide/b2c-governance-and-quotas.html
source: Trailhead: Implement caching in the web server layer | https://trailhead.salesforce.com/content/learn/modules/b2c-implement-cache/b2c-implement-cache-web-server

=== easy
A fast shop avoids doing the same work again. **Caching** means keeping a ready copy.

SFCC has several layers, from closest to the shopper to furthest:
1. **Browser** keeps images and files.
2. **CDN** (the network in front of the shop) keeps static files and pages.
3. **Page cache** on the web server keeps whole HTML pages or parts of pages.
4. **Custom caches** in the app server keep data your code computed.
5. The **database**: slowest.

The trick: cache most of a page, and fetch only the personal bits (cart count, login name) separately with a **remote include**.

**Quotas** are SFCC's safety limits on code, for example how many objects you create in one request. Breaking an enforced quota stops the request with an error.

=== crash
- Layers: browser → CDN (eCDN) → web server **page cache** + static cache → app server **custom caches** (`CacheMgr`) → database.
- Page cache key = full URL (plus personalisation for price books and promotions). Turn it on per site; set with `<iscache>` or `res.cachePeriod` / SFRA `cache.applyDefaultCache` (24h) and `cache.applyPromotionSensitiveCache`.
- Several iscache settings → **shortest wins**. Remote includes have their own policy and aren't invalidated with the parent.
- Never cache personal data. Use remote includes or client-side calls for personal parts.
- Ignore meaningless URL parameters for the cache key (Business Manager feature switch) to raise hit rate.
- Custom caches: defined in `caches.json` (referenced from package.json), `CacheMgr.getCache(id).get(key, loaderFn)`; ~20 MB per app server; not shared across app servers; cleared on code activation and replication. Optional `expireAfterSeconds`.
- Quotas: Business Manager › Administration › Operations › **Quota Status** and quota logs; enforced quotas throw exceptions; warn thresholds at about 60%.
- Classic slow spots: `queryAllSiteProducts` in storefront, `ProductMgr.getProduct` in loops, huge `isloop`s, synchronous services on hot pages, uncached category pages, big transactions, string concatenation of huge payloads.
- Tools: Business Manager **Pipeline Profiler** (controller timings), **Code Profiler**, Reports & Dashboards (Technical), log center.

=== standard
## Cache layers
| Layer | What it caches | You control it with |
|---|---|---|
| Browser | Static assets | Cache headers, versioned file names |
| CDN | Static files, some responses | eCDN settings |
| Web server page cache | HTML responses and remote include fragments | `<iscache>`, `res.cachePeriod`, cache middleware, partitions/invalidation |
| App server custom cache | Computed data | `caches.json` + `CacheMgr` |
| Storage | Precomputed values | Custom attributes / custom objects updated by jobs |

The goal: serve as much as possible from the layer nearest the shopper.

## Page caching in SFRA
```js
var cache = require('*/cartridge/scripts/middleware/cache');
server.get('Show', cache.applyDefaultCache, function (req, res, next) { … });          // ~24h
server.get('Tile', cache.applyPromotionSensitiveCache, function (req, res, next) { … }); // varies by promotions
```
Personalised parts move to their own routes and are included with `<isinclude url="${URLUtils.url('Account-Header')}"/>`. Each remote include costs a request but keeps the big page cacheable.

Invalidate page cache in Business Manager (Sites › Manage Sites › Cache), fully or by partition; it's spread over about 15 minutes in production.

## Custom caches
```json
// caches.json
{ "caches": [ { "id": "StoreConfig", "expireAfterSeconds": 3600 } ] }
```
```js
var cache = require('dw/system/CacheMgr').getCache('StoreConfig');
var cfg = cache.get(siteId + '_' + locale, function () { return loadConfig(siteId, locale); });
```
- About 20 MB for all custom caches per app server.
- Each app server has its own copy; don't use it for data that must be consistent instantly.
- Cleared on code activation and replication.
- Include site and locale in keys.

## Quotas
Limits on API usage and object counts (for example sub-categories per category, objects created per page, string lengths). Check Quota Status and quota logs. Enforced quotas throw and stop the operation; warnings show in logs. Fix code before warnings become errors.

## Common fixes
- Use the search index (`ProductSearchModel`) for listings instead of loading products one by one.
- Read what you need once and pass it down; avoid repeated `getProduct` or `getCategory` in loops.
- Move partner calls off cached pages; use jobs for heavy work.
- Commit job work in chunks.
- Profile with the Pipeline Profiler before and after changes.

=== notes
- Cache the page, personalise the fragment.
- Custom caches are per app server and get cleared on deploys: always load on a miss.
- Watch Quota Status after every release.

=== q basic top
What caching layers exist in SFCC?
---
Browser, CDN, the web server page cache (and static cache), app-server custom caches, and finally storage (precomputed data).

=== q basic top
How do you cache a page but still show the shopper's name?
---
Cache the page and render the name in a remote include (separate uncached controller) or load it with AJAX.

=== q mid top
What's a custom cache and its limits?
---
An app-server key-value cache defined in caches.json and used via CacheMgr. About 20 MB per app server, not synchronised between servers, and cleared on code activation and replication. Always provide a loader for misses.

=== q mid top
What are quotas and what happens when one is exceeded?
---
Platform limits on API usage and object counts. Exceeding an enforced quota throws an exception and stops the operation; otherwise it's logged. Monitor them in Quota Status and quota logs.

=== q mid
Why use promotion-sensitive caching?
---
Prices with promotions differ by shopper context. The promotion-sensitive cache varies the cached response by active promotions so shoppers don't see each other's prices.

=== q adv
The category page is slow (3 s). How do you investigate and fix it?
---
Check the Pipeline Profiler and logs for the controller, confirm page caching applies, look for per-product loops (getProduct, availability, promotions), synchronous service calls and quota warnings. Use the search hits' data, cache tiles, move personal parts to remote includes, and precompute expensive values in jobs.

=== p easy
Which layer?
---
You want to store a JSON config read from a file on every request. Which cache?
---
A **custom cache** (caches.json + CacheMgr) keyed by site and locale, with a loader function.

=== p std
Speed up a store-hours widget
---
Each page calls a store service to show today's opening hours in the header.
---
Move the widget into a remote include `Stores-Hours` with a cache period of an hour (hours change rarely), cache the service response in a custom cache with `expireAfterSeconds: 3600`, set a short service timeout and hide the widget on failure. The main pages stay fully cacheable.
