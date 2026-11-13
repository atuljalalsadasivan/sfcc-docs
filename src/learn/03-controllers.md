id: controllers
title: SFRA controllers and middleware
icon: code
time: 10|5|25
summary: Routes, the req/res/next chain, and extending with append, prepend and replace.
source: Salesforce developers: SFRA modules | https://developer.salesforce.com/docs/commerce/commerce-api/guide/b2c-sfra-modules.html
source: Salesforce developers: SFRA features and components | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-sfra-features-and-comps.html
source: Salesforce developers: Customize SFRA | https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-customizing-sfra.html

=== easy
A **controller** is the code that answers a URL. In SFRA the URL `/Product-Show?pid=123` means: controller file **Product.js**, route **Show**.

A route is a **line of small steps** (functions). Each step gets:
- `req`: what the shopper sent,
- `res`: what you'll send back,
- `next`: "I'm done, go to the next step".

The last step usually calls `res.render('some/template', data)` to show a page, or `res.json(data)` for AJAX.

To change a base route without copying it you can:
- **append**: add a step at the **end** (most common, for adding data),
- **prepend**: add a step at the **start** (checks before the base runs),
- **replace**: throw the old steps away and write new ones.

**Key words**
- **Route:** controller name + action, like `Cart-AddProduct`.
- **Middleware:** one step in the line.
- **viewData:** the data that goes to the template.

=== crash
- Every controller: `var server = require('server');` … `module.exports = server.exports();`
- Routes: `server.get('Name', mw1, mw2, fn)` / `server.post(...)` / `server.use(...)` for any method.
- Middleware signature `(req, res, next)`; always call `next()` unless you deliberately end the chain.
- `res.render(template, data)`, `res.json(obj)`, `res.redirect(url)`; `res.getViewData()` / `res.setViewData(obj)` (merges).
- Extend: `var page = module.superModule; server.extend(page);` then `append` / `prepend` / `replace`.
- `append` = most common (modify view data after base). `prepend` = validation/setup before base. `replace` = when base logic must not run (for example it does a transaction you'd duplicate).
- Ready-made middleware: `cache.applyDefaultCache`, `csrfProtection.generateToken` / `validateRequest` / `validateAjaxRequest`, `userLoggedIn.validateLoggedIn`, `consentTracking.consent`.
- `res.render` doesn't render immediately: it's rendered **after** the whole chain finishes, using the final view data.
- `this.on('route:BeforeComplete', …)` runs code after the chain (SFRA uses it for saving forms in a transaction).

=== standard
## Anatomy
```js
'use strict';
var server = require('server');
var cache = require('*/cartridge/scripts/middleware/cache');

server.get('Show', cache.applyDefaultCache, function (req, res, next) {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var product = ProductMgr.getProduct(req.querystring.pid);
    if (!product) { res.setStatusCode(404); res.render('error/notFound'); return next(); }
    res.render('product/simple', { name: product.name });
    next();
});

module.exports = server.exports();
```
- `req.querystring`, `req.form`, `req.httpMethod`, `req.currentCustomer`, `req.locale`, `req.session` …
- `res.render`, `res.json`, `res.redirect`, `res.setStatusCode`, `res.cachePeriod`, `res.getViewData`, `res.setViewData`.

## How rendering really works
`res.render()` only records the template and data. SFRA renders after the last middleware, so appended steps can still change view data. That's why `append` works for adding fields to a page.

## Extending a base controller
```js
var server = require('server');
var page = module.superModule;      // base Product.js
server.extend(page);

server.append('Show', function (req, res, next) {
    var viewData = res.getViewData();
    viewData.deliveryMessage = 'Ships in 24h';
    res.setViewData(viewData);
    next();
});

server.prepend('Show', function (req, res, next) {
    if (!req.querystring.pid) { res.redirect(require('dw/web/URLUtils').url('Home-Show')); return next(); }
    next();
});

module.exports = server.exports();
```

## Choosing append, prepend or replace
| Use | When |
|---|---|
| `append` | Add or change data shown by the page. Base logic still runs first. |
| `prepend` | Check permissions or prepare something before the base. |
| `replace` | Base logic is wrong for you, or is expensive / has side effects (a payment call, a transaction, a service call) that must not run twice. |

Appending after a base that already wrote to the database means both run. If you then redo the work, you get duplicates or double cost. Replace in that case.

## Stopping the chain
To stop early, don't call the remaining logic. Render or redirect, then `return next();`. Calling `next(new Error(...))` sends the request to the error handling.

## Events
`this.on('route:BeforeComplete', function (req, res) { … })` inside a middleware runs at the end of the chain. SFRA uses it to save form data inside `Transaction.wrap` after rendering decisions are made.

=== notes
- Prefer `append`. It survives SFRA upgrades best.
- Use `replace` when the base would do expensive or one-time work you'd otherwise repeat.
- Put CSRF validation on every state-changing POST route.
- Keep controllers thin: put logic in helpers and models so it can be unit tested.

=== q basic top
What are req, res and next in an SFRA middleware?
---
`req` is the request (query string, form, customer, locale), `res` is the response object (render, json, redirect, view data), and `next` passes control to the next middleware in the route's chain.

=== q basic top
What's the difference between server.append, server.prepend and server.replace?
---
Append adds middleware at the end of an existing route, prepend at the start, and replace discards the original chain and uses only the new middleware.

=== q mid top
When would you choose replace over append?
---
When the base route performs work that must not run (or must not run twice): a payment or service call, a database transaction, an expensive lookup, or logic that's simply wrong for your business. Appending would run the base first.

=== q mid top
How can appended middleware change the page if the base already called res.render?
---
`res.render` only stores the template name and data. Rendering happens after the whole chain finishes, so later middleware can still edit view data with `getViewData`/`setViewData`.

=== q mid
How do you extend a base controller?
---
`var page = module.superModule; server.extend(page);`, then `server.append/prepend/replace('RouteName', …)`, and finally `module.exports = server.exports();`.

=== q mid
How do you return JSON for an AJAX call?
---
Call `res.json(object)` in the route (and usually `next()`); SFRA serialises it with the right content type.

=== q adv
What is route:BeforeComplete used for?
---
It's an event fired after all middleware in a route ran. SFRA uses it to do work at the very end, such as saving form data in a transaction once the final view data is decided.

=== q adv
How would you add a login check to an existing route without changing it?
---
`server.prepend('Show', userLoggedIn.validateLoggedIn)` (or your own middleware) in an overlay controller that extends `module.superModule`.

=== p easy
Read the URL
---
What controller file and route handle `/Cart-AddProduct`?
---
File **Cart.js**, route **AddProduct** (registered with `server.post('AddProduct', …)`).

=== p std
Add data to the product page
---
Add `isNewArrival` (true when the product's `creationDate` is under 30 days old) to the product page without copying Product.js.
---
```js
var server = require('server');
server.extend(module.superModule);
server.append('Show', function (req, res, next) {
    var viewData = res.getViewData();
    var ProductMgr = require('dw/catalog/ProductMgr');
    var p = ProductMgr.getProduct(viewData.product.id);
    var days = (Date.now() - p.creationDate.getTime()) / 86400000;
    viewData.isNewArrival = days < 30;
    res.setViewData(viewData);
    next();
});
module.exports = server.exports();
```
In the template: `<isif condition="${pdict.isNewArrival}">New</isif>`.

=== p std
Avoid a double payment call
---
The base `CheckoutServices-PlaceOrder` calls the payment provider. You need different payment handling. Append or replace?
---
**Replace.** With append the base would still call the provider first, then yours: two authorisations. Use `server.replace('PlaceOrder', csrfProtection.validateAjaxRequest, function (req, res, next) { … })` and re-implement the flow, reusing base helpers where possible.
