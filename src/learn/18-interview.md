id: interview
title: Interview playbook: scenarios and how to answer
icon: users
time: 6|5|20
summary: How SFCC interviews run, answer structure, and scenario questions that combine topics.
source: Trailhead: B2C Commerce for developers trail (overview of topics) | https://trailhead.salesforce.com/
source: Salesforce developers: B2C Commerce documentation | https://developer.salesforce.com/docs/commerce/b2c-commerce/overview

=== easy
Most SFCC developer interviews mix three things:
1. **Basics:** cartridge path, controllers, ISML, jobs, services, Business Manager.
2. **"What would you do if…" scenarios:** a product doesn't show, checkout is slow, a partner is down.
3. **Your own work:** a feature you built, a bug you fixed.

A simple way to answer anything:
- **Say what it is** in one line.
- **Say how it works** in SFCC (the files, objects or settings).
- **Give a real example** or a pitfall.

For your own work use **Situation → Task → Action → Result**: what the problem was, your part, what you built, what improved. Keep your Solution notes ready for this.

=== crash
- Answer shape: **definition → how in SFCC → example/pitfall** (30–60 seconds), then stop and let them dig.
- Always mention trade-offs: append vs replace, cache vs freshness, sync service vs job.
- Name the real things: `module.superModule`, `Transaction.wrap`, `dw.order.calculate`, `steptypes.json`, `LocalServiceRegistry`, `caches.json`, SLAS public/private.
- Scenario method: **clarify → check the obvious → look at evidence (logs, BM, profiler) → fix → prevent**.
- Prepare 3 stories with numbers (page time cut, job runtime cut, incident fixed).
- Senior signals: performance and caching, quotas, security (CSRF, XSS, PCI), replication and release process, integration resilience (timeouts, circuit breakers), upgrade-safe customisation.
- Don't bluff: say how you'd find out (Script API docs, schemas, logs).

=== standard
## How to structure answers
1. **One-line definition.** "The cartridge path is the ordered list of cartridges searched left to right."
2. **How it works in SFCC.** Files, APIs, Business Manager screens.
3. **Example or pitfall.** "We overrode the PDP template and lost an SFRA upgrade fix; since then we extend models instead."
4. **Trade-off** if there is one.

## Scenario playbook
| Scenario | Strong answer outline |
|---|---|
| Product not visible | Storefront category assignment → online/searchable (site) → price for qty 1 in active price book/currency → index → inventory filter → cache |
| Checkout slow at peak | Profiler/logs → service timeouts (tax, payment, fraud) → circuit breakers and fallbacks → avoid recalculation loops → quotas → load test |
| Partner API down | Circuit breaker + timeout, graceful UI fallback, queue for retry in a job, alerts |
| Duplicate orders | Disable button, server-side state check, idempotent payment requests, order/basket checks |
| Wrong prices on cached pages | Promotion-sensitive cache, remote includes, invalidation, price book assignment |
| Nightly job too slow | Chunk-oriented step, chunk size, stream files, avoid per-item lookups, parallel flows, system import steps |
| New field on PDP | Custom attribute + attribute group → extend product model via superModule → template → test |
| Multi-country launch | Sites per country, locales and currencies, price books per currency, shared master catalog, localised content, replication plan |
| Headless migration | SCAPI Shopper APIs + SLAS (public/private), hooks/custom APIs, hybrid auth during transition, caching at the edge |

## Talking about your work (STAR)
- **Situation:** "Product listing took 3.5 s on mobile during sales."
- **Task:** "I owned the performance fix."
- **Action:** "Profiled with the Pipeline Profiler, found per-tile availability calls, moved them to search hit data, cached tiles with promotion-sensitive cache, moved the mini-cart to a remote include."
- **Result:** "1.2 s median, cache hit rate up from 40% to 85%, no quota warnings."

## Questions to ask them
- Which storefront: SFRA, composable, or hybrid?
- How do they release: CI, sandboxes per branch, replication schedule?
- Biggest pain: performance, integrations, data feeds?

=== notes
- Use numbers in stories.
- Mention the trade-off, not only the solution.
- Saying "I'd check X in the logs/profiler" is better than guessing.

=== q basic top
Walk me through what happens when a shopper opens a product page in SFRA.
---
The URL maps to `Product-Show`. The web server checks the page cache; on a miss the app server resolves the controller via the cartridge path, middleware runs (cache, consent), the product factory builds the model, `res.render` schedules the template, ISML renders with decorators and includes, and the response is cached according to the cache settings; remote includes are resolved separately.

=== q mid top
How do you customise SFRA safely so upgrades stay easy?
---
Put custom code in your own cartridge on the left, extend controllers with append/prepend (replace only when needed), extend models with module.superModule, use hooks for business logic, keep template overrides minimal, and never edit app_storefront_base or the server module.

=== q mid top
Tell me how you'd integrate a new payment provider.
---
Set up the payment processor and method in Business Manager, implement `app.payment.processor.<id>` Handle/Authorize hooks (or the provider cartridge), call the provider through LocalServiceRegistry with timeouts, use tokens or hosted fields (PCI), handle createOrder → authorise → placeOrder/failOrder, async returns or webhooks, and logging with masking.

=== q adv top
Design a nightly product feed import from a PIM for 500 000 products and three sites.
---
PIM drops XML into IMPEX/src via SFTP; a job with ImportCatalog (master catalog, Merge) then storefront assignments, price books per currency, inventory; chunked custom steps only where transformation is needed; run on staging and replicate, or import frequently-changing data directly into production too; then indexing; monitoring with job alerts and quota checks.

=== q adv
What are the biggest performance risks you've seen and how did you handle them?
---
Uncached pages with personal data, per-product lookups in loops, synchronous services on hot paths, huge transactions in jobs, and quota violations. Fixes: page cache plus remote includes, search-hit data, custom caches, jobs and chunking, service timeouts with fallbacks, profiler-driven tuning.

=== p easy
Practice a one-minute answer
---
"What is a hook?": answer using definition → how → example.
---
"A hook is a named extension point where the platform or my code runs registered scripts. In SFCC I register it in hooks.json, which the cartridge's package.json points to, and call it with HookMgr.callHook. For example we implemented dw.order.calculateTax to call an external tax service, and all cartridges' implementations run in cartridge-path order, so we made sure only one cartridge registered it."

=== p std
Scenario drill
---
"After a release, add-to-cart fails for some shoppers with no error shown." Talk it through.
---
Clarify scope (which sites, devices, logged-in or guest?). Reproduce on development. Check error/customerror logs by time and request ID, browser console for CSRF or 500 responses. Compare code versions (diff the Cart controller and CSRF changes), check quota logs (basket line item limits), check product availability and price for the SKUs. Roll back by activating the previous code version if impact is high, fix forward with a test, add a monitoring alert for add-to-cart errors.
