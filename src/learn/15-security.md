id: security
title: Security
icon: lock
time: 6|4|15
summary: CSRF, XSS, injection, secrets, personal data and safe deployment.
source: Script API: CSRFProtection | https://documentation.b2c.commercecloud.salesforce.com/DOC1/topic/com.demandware.dochelp/DWAPI/scriptapi/html/api/class_dw_web_CSRFProtection.html
source: Salesforce developers: Secure your B2C Commerce solution | https://developer.salesforce.com/docs/platform/isvforce/guide/secure-code-b2c-commerce.html
source: Salesforce developers: Security (headless) | https://developer.salesforce.com/docs/commerce/commerce-solutions/guide/security.html

=== easy
Three classic attacks and the SFCC answer:
- **XSS** (someone injects a script into your page): print with ISML's default encoding (`${}`, `<isprint>`), never turn it off for shopper input.
- **CSRF** (a bad site makes the shopper's browser submit your form): every form that changes something carries a secret **CSRF token**, and the server checks it.
- **Leaking secrets**: passwords and API keys go into **service credentials** in Business Manager, never into code or logs.

Also: never store card numbers (use payment tokens), never log personal data, and check on the server that a shopper may only see their own orders and addresses.

=== crash
- **CSRF** in SFRA: `csrfProtection.generateToken` on the GET that renders the form; `csrfProtection.validateRequest` (form POST) or `validateAjaxRequest` (AJAX) on the handler. Template: `<input type="hidden" name="${pdict.csrf.tokenName}" value="${pdict.csrf.token}"/>`. Tokens are tied to the session.
- **XSS:** keep default encoding; `encoding="off"` only for trusted HTML; `SecureEncoder.forJavaScript/forHtmlInDoubleQuoteAttribute…` for other contexts; validate input in form definitions (mandatory, regexp, max-length).
- **Authorization:** check ownership (`order.customerNo === customer.profile.customerNo`), use `userLoggedIn.validateLoggedIn` middleware; never trust IDs from the browser.
- **Query injection:** use placeholders in queries (`'custom.email = {0}'`), never string concatenation.
- **Secrets:** service credentials or encrypted site preferences (password type); not in code, cartridges or Git.
- **PCI:** don't store or log PAN/CVV; use the payment provider's tokens or hosted fields.
- **Logs:** mask personal data (`filterLogMessage`), no tokens or passwords.
- **Headers:** security headers (CSP, X-Frame-Options, HSTS) via the platform's HTTP headers configuration (`httpHeadersConf.json` in SFRA cartridges).
- **Access:** Business Manager roles with least privilege; two-factor login; client certificate needed for code upload to staging.

=== standard
## CSRF
```js
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.get('EditProfile', csrfProtection.generateToken, function (req, res, next) {
    res.render('account/editProfile', { profileForm: form });   // pdict.csrf.* added automatically
    next();
});

server.post('SaveProfile', csrfProtection.validateRequest, function (req, res, next) {
    // reached only with a valid token
    next();
});
```
Template:
```isml
<input type="hidden" name="${pdict.csrf.tokenName}" value="${pdict.csrf.token}"/>
```
Use `validateAjaxRequest` for AJAX posts (returns a JSON error instead of a page). Underneath is `dw.web.CSRFProtection` (`generateToken`, `getTokenName`, `validateRequest`).

## XSS
- `${value}` and `<isprint value="${value}"/>` encode HTML. Don't use `encoding="off"` for anything a user can influence.
- Values placed inside JavaScript: `dw.util.SecureEncoder.forJavaScript(value)`, or pass data via `data-` attributes / JSON with encoding.
- Server-side validation via form XML (`mandatory`, `regexp`, `max-length`, `range`), not just browser checks.

## Authorization
Every controller that shows or changes private data must check the logged-in customer owns it:
```js
var order = OrderMgr.getOrder(req.querystring.orderID, req.querystring.orderToken);
if (!order || order.customerNo !== req.currentCustomer.profile.customerNo) { res.setStatusCode(404); … }
```

## Injection
```js
CustomObjectMgr.queryCustomObjects('Signup', 'custom.email = {0}', null, email);   // safe placeholder
```

## Secrets and data
- API keys and passwords: service credentials (per instance), or password-type preferences.
- Never commit secrets, `dw.json` with passwords, or certificates to Git.
- Cards: hosted payment fields or tokens; nothing card-related in logs, custom attributes or custom objects.
- Respect consent (SFRA `consentTracking`) and data retention.

=== notes
- Every state-changing POST needs CSRF validation.
- Default encoding on; turning it off needs a written reason.
- Ownership checks on every account and order route.

=== q basic top
How does SFRA protect against CSRF?
---
The page that renders a form uses `csrfProtection.generateToken` to add a session-bound token to the form; the handling route uses `csrfProtection.validateRequest` (or `validateAjaxRequest`) and rejects requests without a valid token.

=== q basic top
How do you prevent XSS in templates?
---
Keep ISML's default HTML encoding on `${}` and `<isprint>`, use SecureEncoder for non-HTML contexts, and validate input server-side.

=== q mid top
Where should API keys live?
---
In service credentials (or encrypted password-type preferences) configured per instance in Business Manager, never in code, cartridges, logs or Git.

=== q mid
How do you safely query custom objects with user input?
---
Use placeholders: `queryCustomObjects(type, 'custom.email = {0}', sort, email)`; never concatenate input into the query string.

=== q adv
An order details URL takes orderID in the query. What must the controller check?
---
That the order exists and belongs to the logged-in customer (or the order token matches for guests); otherwise return 404 so other customers' orders can't be viewed by changing the ID.

=== p easy
Spot the bug
---
`<isprint value="${pdict.q}" encoding="off"/>` on the search page. What's wrong?
---
`q` comes from the URL, so with encoding off an attacker can inject script (reflected XSS). Remove `encoding="off"`.

=== p std
Protect a new form
---
Add a "change newsletter preference" form with CSRF protection.
---
GET route with `csrfProtection.generateToken`, template with the hidden token input, POST route with `csrfProtection.validateAjaxRequest` (AJAX) plus `userLoggedIn.validateLoggedInAjax`, then update the profile inside `Transaction.wrap` and return JSON.
