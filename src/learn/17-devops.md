id: devops
title: Deployment, debugging, logging and testing
icon: bug
time: 7|4|18
summary: Uploading code, code versions, CI, logs, debugging tools and unit tests.
source: Trailhead: Explore continuous integration | https://trailhead.salesforce.com/content/learn/modules/b2c-build-processes-and-tests-for-technical-architects/b2c-explore-continuous-integration
source: Salesforce developers: Governance and quotas | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-governance-and-quotas.html

=== easy
**Getting code onto an instance:** build the front-end files, then upload the cartridges into a **code version** with a tool (the VS Code Prophet extension, the `sfcc-ci` command line tool, or the newer B2C CLI). A small `dw.json` file says which instance and code version to use. Then activate the version.

**Finding problems:**
- **Logs** in Business Manager (Log Center / Request logs) or over WebDAV: error, warn, custom logs.
- **Debugger:** set breakpoints in VS Code and step through server code on a sandbox.
- **Profilers** in Business Manager show which controllers are slow.

**Testing:** SFRA comes with unit tests (Mocha) that run on your computer with fake platform objects, and integration/browser tests that run against a sandbox.

=== crash
- Build: `npm run compile:js`, `compile:scss` (sgmf-scripts/webpack) → `static/`. Lint with ESLint.
- Upload: Prophet (VS Code), `sfcc-ci code:deploy`, or the B2C CLI; `dw.json` holds hostname, code version, credentials (keep it out of Git). Staging upload needs a client certificate (two-factor).
- Code versions: Administration › Site Development › Code Deployment; activate; keep the previous for rollback. Activation clears custom caches.
- Logs: `error-*`, `warn-*`, `customerror-*`, `custom-<prefix>-*`, `quota-*`, `service-*` (communication logs), `jobs-*`; view in Log Center or WebDAV `/Logs`. Request ID ties log lines together.
- `Logger.getLogger(prefix, category)`; levels set in Custom Log Settings; debug logging off in production.
- Debugger: script debugger enabled per instance (sandbox), VS Code launch config with the instance credentials.
- Profiling: Pipeline Profiler (per controller/route timings), Code Profiler, Technical Reports & Dashboards, Quota Status.
- Unit tests: Mocha + Chai + `proxyquire` to replace `dw/*` modules with mocks; run with `npm test`. Integration tests call routes on a sandbox; browser tests with tools like Cypress or Playwright.
- CI: feature branch → sandbox (on-demand sandbox can be created per pull request) → development → staging → replication to production.

=== standard
## Build and deploy
```json
// dw.json (local only, never commit)
{ "hostname": "dev01-eu01-acme.demandware.net", "code-version": "release_2026_11", "username": "…", "password": "…" }
```
- Compile client assets: `npm run compile:js && npm run compile:scss` (SFRA's `sgmf-scripts`), lint: `npm run lint`.
- Upload with Prophet's upload-on-save while developing, or `sfcc-ci code:deploy archive.zip -i <host> --activate` in CI.
- Staging requires two-factor auth with a **client certificate** for code upload.
- Activate in Business Manager or via CLI; keep the previous version for rollback.

## Logs
| Log | Contains |
|---|---|
| error / warn | Platform and script errors and warnings |
| customerror / customwarn | `Logger.error/warn` without a custom file |
| custom-<prefix> | Your named logs |
| service-<prefix> | Service communication logs (if enabled) |
| quota | Quota warnings and violations |
| jobs | Job execution |

Read them in Business Manager's Log Center or download via WebDAV (`/on/demandware.servlet/webdav/Sites/Logs`). Search by request ID or session ID to follow one request.

## Debugging
Enable the script debugger on a sandbox, connect from VS Code (Prophet), set breakpoints in controllers and scripts, inspect variables. Never debug on production.

## Unit testing
```js
// test/unit/app_custom/scripts/helpers/priceHelper.js
var assert = require('chai').assert;
var proxyquire = require('proxyquire').noCallThru();
var helper = proxyquire('../../../../cartridges/app_custom/cartridge/scripts/helpers/priceHelper', {
    'dw/system/Site': { getCurrent: function () { return { getCustomPreferenceValue: function () { return 50; } }; } }
});
describe('priceHelper.isFreeShipping', function () {
    it('is true at the threshold', function () { assert.isTrue(helper.isFreeShipping(50)); });
    it('is false below it', function () { assert.isFalse(helper.isFreeShipping(49.99)); });
});
```
`proxyquire` swaps platform modules (`dw/...`) with fakes so the logic runs in Node. Keep logic in helpers to make this easy.

## CI flow
Feature branch → automated sandbox deploy and tests → merge → development instance → staging (UAT) → data/code replication to production. Don't run tests on staging; don't let test data reach staging.

=== notes
- Never commit dw.json, passwords or certificates.
- Keep the previous code version for one-click rollback.
- Put logic in helpers so it can be unit tested with proxyquire.

=== q basic top
How do you deploy code to an instance?
---
Build client assets, upload the cartridges into a code version (Prophet, sfcc-ci or B2C CLI using dw.json settings), then activate that code version. For production, deploy to staging and use code replication.

=== q basic top
Where do you find errors from a storefront request?
---
In the error and customerror logs (Log Center in Business Manager or WebDAV Logs folder), filtered by time or request ID.

=== q mid top
How do you unit test SFCC code that uses dw.* modules?
---
Run Mocha in Node and use proxyquire (noCallThru) to replace `dw/...` requires with mocks, testing helper logic without an instance.

=== q mid
How do you roll back a bad release?
---
Activate the previous code version (on production via code replication history or the code deployment page), or run an undo code replication; then fix forward.

=== q mid
Which tools show performance problems?
---
Pipeline Profiler (per route timings), Code Profiler, Technical Reports & Dashboards, quota status and logs.

=== q adv
How would you design CI/CD for an SFCC project?
---
Lint and unit test on every pull request; build and deploy to an on-demand sandbox for integration/browser tests; after merge deploy to development, then to staging with certificate-based auth; replicate to production manually (delivery) or automated (deployment), keeping previous versions for rollback and data deployed via site imports.

=== p easy
Read a log line
---
A shopper reports an error at 10:42. Where do you start?
---
Log Center → error and customerror logs around 10:42, find the request ID, then follow that ID through other logs (custom, service, quota).

=== p std
Unit test a helper
---
Test `isFreeShipping(total)` that compares with site preference `freeShippingThreshold`.
---
See the code above: proxyquire `dw/system/Site` with a fake returning 50, and assert boundary values (49.99 false, 50 true, 100 true). Add a case for a missing preference (null) returning false.
