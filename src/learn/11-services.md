id: services
title: Web services (service framework)
icon: world
time: 7|4|18
summary: LocalServiceRegistry, service configuration, profiles, credentials, mocking, timeouts, circuit breaker and rate limits.
source: Trailhead: Build a B2C Commerce web service integration | https://trailhead.salesforce.com/content/learn/modules/salesforce-b2c-commerce-third-party-integration-strategies-2/build-a-b2c-commerce-web-service-integration
source: Trailhead: Learn the web services framework | https://trailhead.salesforce.com/content/learn/modules/b2c-integration-approaches/b2c-learn-web-services-framework

=== easy
When SFCC needs to talk to another system (payment, tax, loyalty, ERP), it uses the **service framework**.

In Business Manager (Administration › Operations › Services) you set up three things:
- **Credential:** the URL and login.
- **Profile:** safety settings: how long to wait (**timeout**), how many calls are allowed (**rate limit**), and when to stop calling a broken service (**circuit breaker**).
- **Service:** a name (ID) that ties a credential and a profile together.

In code you create the service with the same ID, describe how to build the request and read the response, then call it:
```js
var svc = LocalServiceRegistry.createService('loyalty.http.points', { createRequest: …, parseResponse: … });
var result = svc.call({ customerNo: '123' });
if (result.ok) { … }
```
The circuit breaker is like a fuse: if the other system keeps failing, SFCC stops calling it for a while so your shop stays fast.

=== crash
- `dw.svc.LocalServiceRegistry.createService(id, callbacks)`; `ServiceRegistry` (global) is deprecated.
- Callbacks: `createRequest(svc, args)` (set URL, method, headers, return body), `parseResponse(svc, client)` (return result object), `mockCall(svc, request)` (fake response for tests; createRequest and parseResponse still run), `filterLogMessage(msg)` (mask secrets), `getRequestLogMessage` / `getResponseLogMessage`.
- `service.call(args)` returns `dw.svc.Result`: `ok`, `status` (OK, ERROR, SERVICE_UNAVAILABLE), `object`, `error`, `errorMessage`, `unavailableReason` (TIMEOUT, RATE_LIMITED, CIRCUIT_BROKEN, DISABLED, CONFIG_PROBLEM).
- Business Manager: Service (ID, type HTTP/SOAP/FTP/SFTP/generic, mode live/mocked, enabled, logging, log prefix) + Profile (timeout, rate limit calls/interval, circuit breaker calls/interval) + Credential (URL, user, password).
- **Always set an explicit low timeout**; platform defaults are long. Keep circuit breaker on.
- Rate limiter and circuit breaker are checked **before** the call; when tripped no call is made.
- Communication log for debugging; never log personal or card data; turn logging down in production.
- Service IDs convention: `cartridge.type.action` (for example `int_tax.http.calculate`).

=== standard
## Business Manager setup
| Part | Settings |
|---|---|
| Credential | URL, user, password (or certificates) |
| Profile | Timeout (ms), Rate limit (max calls per interval), Circuit breaker (max failed calls per interval) |
| Service | ID, type, enabled, mode (live or mocked), communication log, log name prefix; links one credential and one profile |

Services can share profiles. Credentials can be swapped per instance (sandbox vs production URL) without code changes.

## Code
```js
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

var pointsService = LocalServiceRegistry.createService('int_loyalty.http.points', {
    createRequest: function (svc, args) {
        svc.setRequestMethod('GET');
        svc.addHeader('Accept', 'application/json');
        svc.setURL(svc.getConfiguration().getCredential().getURL() + '/customers/' + encodeURIComponent(args.customerNo) + '/points');
        return null;                          // GET has no body
    },
    parseResponse: function (svc, client) {
        return JSON.parse(client.text);
    },
    mockCall: function () {
        return { statusCode: 200, statusMessage: 'OK', text: '{"points": 120}' };
    },
    filterLogMessage: function (msg) {
        return msg.replace(/"email":"[^"]*"/g, '"email":"***"');
    }
});

var result = pointsService.call({ customerNo: customer.profile.customerNo });
if (result.ok) {
    points = result.object.points;
} else {
    Logger.warn('Points unavailable: {0} {1}', result.status, result.unavailableReason || result.errorMessage);
    points = null;                            // show the page without points
}
```

## Resilience
- **Timeout:** fail fast so a slow partner doesn't block your threads. Choose it from the partner's SLA.
- **Circuit breaker:** after N failures in the interval the service is considered down; calls return SERVICE_UNAVAILABLE immediately for a while.
- **Rate limiter:** caps calls per interval; useful for partners with quotas.
- **Fallback:** always handle `!result.ok` gracefully: hide the widget, use cached data, or queue the work for a job.
- **Cache** stable responses (custom cache) to reduce calls.

## Where to call services
Avoid synchronous partner calls on cached pages and hot paths. Prefer jobs for bulk sync, and client-side or remote includes for optional widgets.

=== notes
- Never rely on default timeouts; set an explicit low value.
- Handle the not-ok result every time; the partner will be down one day.
- Mask secrets and personal data in logs with filterLogMessage.

=== q basic top
What three Business Manager objects make up a service?
---
The credential (URL and authentication), the profile (timeout, rate limit, circuit breaker) and the service definition itself (ID, type, mode, logging) that links them.

=== q basic top
What is a circuit breaker?
---
A protection that stops calling a service after too many failures within an interval, returning "unavailable" immediately for a while so the storefront isn't slowed down by a broken partner.

=== q mid top
Rate limit vs circuit breaker?
---
Rate limiting caps how many calls are allowed per interval regardless of success. The circuit breaker reacts to failures and suspends calls when too many fail.

=== q mid top
What callbacks does createService take?
---
Mainly `createRequest` (build the request, return the body) and `parseResponse` (turn the response into a result). Optional: `mockCall` for mocked mode, `filterLogMessage` and log message callbacks, `execute` and `initServiceClient` for special cases.

=== q mid
How do you test without the real partner?
---
Implement `mockCall` and set the service mode to mocked in Business Manager; createRequest and parseResponse still run, so your logic is tested.

=== q adv
A tax provider is slow during sales and checkout times out. What do you do?
---
Lower and tune the timeout, keep the circuit breaker on, add a fallback (estimated tax with recalculation later, or a clear retry message), cache what's cacheable, and agree on SLAs. Monitor service logs and quota/timeouts.

=== p easy
Read a result
---
`result.ok` is false and `result.unavailableReason` is `CIRCUIT_BROKEN`. What happened?
---
Too many recent calls failed, so the circuit breaker opened and SFCC didn't even call the partner. Show a fallback and check the partner's health.

=== p std
Write a POST service
---
Send `{orderNo, total}` as JSON to an ERP and return its ID.
---
```js
var svc = LocalServiceRegistry.createService('int_erp.http.order.create', {
    createRequest: function (s, order) {
        s.setRequestMethod('POST');
        s.addHeader('Content-Type', 'application/json');
        return JSON.stringify({ orderNo: order.orderNo, total: order.totalGrossPrice.value });
    },
    parseResponse: function (s, client) { return JSON.parse(client.text).id; }
});
var r = svc.call(order);
var erpId = r.ok ? r.object : null;
```
