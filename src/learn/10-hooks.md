id: hooks
title: Hooks and extension points
icon: link
time: 6|4|15
summary: hooks.json, system hooks, OCAPI/SCAPI hooks and your own extension points.
source: Salesforce developers: SFRA hooks | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-sfra-hooks.html
source: Salesforce developers: Customization with hooks (SCAPI) | https://developer.salesforce.com/docs/commerce/commerce-api/guide/extensibility_via_hooks.html
source: Script API: HookMgr | https://documentation.b2c.commercecloud.salesforce.com/DOC1/topic/com.demandware.dochelp/DWAPI/scriptapi/html/api/class_dw_system_HookMgr.html

=== easy
A **hook** is a named "plug-in socket" in SFCC. The platform (or your code) says "at this moment, run whatever is plugged into the socket called X".

You plug in your code by listing it in **hooks.json**:
```json
{ "hooks": [ { "name": "dw.order.calculateTax", "script": "./hooks/tax.js" } ] }
```
and pointing to that file from your cartridge's `package.json`.

Three kinds:
- **System hooks:** platform business logic like basket calculation or payment (`dw.order.calculate`).
- **API hooks:** run before or after headless API calls (`dw.ocapi.shop.basket.afterPOST`).
- **Custom hooks:** your own sockets, called with `HookMgr.callHook('app.something', 'fn', args)`.

=== crash
- Register in `cartridge/scripts/hooks.json`, referenced by `"hooks": "./cartridge/scripts/hooks.json"` in the cartridge's `package.json`.
- Each entry: `name` (extension point) + `script` (module exporting the function).
- Call: `HookMgr.callHook(extensionPoint, functionName, args…)`; check with `HookMgr.hasHook(extensionPoint)`.
- If several cartridges register the same hook, **all run**, in cartridge path order. Within one hooks.json you can't control order.
- System hooks: `dw.order.calculate`, `dw.order.calculateShipping`, `dw.order.calculateTax`, `dw.order.createOrderNo`, payment hooks (`dw.order.payment.authorize`, …).
- SFRA payment uses custom hooks `app.payment.processor.<id>` with `Handle` / `Authorize`.
- OCAPI/SCAPI hooks: `before…` (validate input), `after…` (change data, still in transaction), `modify…Response` (shape the JSON). Names keep the `dw.ocapi.shop.*` prefix for both APIs.
- API hooks returning a Status with error stop the request; returning **any value** from some hooks skips later registered hooks and the system default. Return nothing to continue.
- Keep hooks fast: they run on every matching request.

=== standard
## Registering
```json
// app_custom/package.json
{ "name": "app_custom", "hooks": "./cartridge/scripts/hooks.json" }
```
```json
// app_custom/cartridge/scripts/hooks.json
{
  "hooks": [
    { "name": "dw.order.calculateTax", "script": "./hooks/taxCalc.js" },
    { "name": "dw.ocapi.shop.basket.modifyGETResponse", "script": "./hooks/basketResponse.js" },
    { "name": "app.checkout.validate", "script": "./hooks/checkoutValidate.js" }
  ]
}
```
```js
// hooks/taxCalc.js
exports.calculateTax = function (basket) {
    // call the tax service, set taxes on line items …
    return new (require('dw/system/Status'))(require('dw/system/Status').OK);
};
```

## Calling custom hooks
```js
var HookMgr = require('dw/system/HookMgr');
if (HookMgr.hasHook('app.checkout.validate')) {
    var status = HookMgr.callHook('app.checkout.validate', 'validate', basket);
    if (status && status.error) { /* stop */ }
}
```
Custom hooks let integration cartridges plug into your checkout without you editing their code (and vice versa).

## Running order
All registered implementations of an extension point run, across cartridges in path order. Don't rely on order inside one hooks.json.

## OCAPI / SCAPI hooks
| Hook | Use |
|---|---|
| `before<METHOD>` | Validate or reject input early |
| `after<METHOD>` | Change persistent data; runs in the request transaction |
| `modify<METHOD>Response` | Add or remove fields in the response document (for example `c_` custom properties) |

The same hook names (with the historical `dw.ocapi.shop` prefix) run for SCAPI and OCAPI shopper calls. Return a `Status` with error to fail the request; returning a value can stop later hooks and the system implementation, so return `undefined` when you want processing to continue.

=== notes
- Every cartridge's implementation of a hook runs: duplicates can double-apply logic.
- Keep hook code quick, with no unnecessary database reads.
- Prefer hooks over replacing controllers when the platform offers an extension point.

=== q basic top
What is a hook and how do you register one?
---
A named extension point where custom code runs. You register it in a hooks.json file (name + script) that the cartridge's package.json points to.

=== q basic
How do you call a custom hook?
---
`HookMgr.callHook('extension.point', 'functionName', args…)`, optionally after checking `HookMgr.hasHook`.

=== q mid top
If two cartridges register dw.order.calculateTax, which runs?
---
Both. All registered hooks for an extension point run, in the order of the cartridges on the cartridge path.

=== q mid top
What are before, after and modifyResponse hooks in OCAPI/SCAPI?
---
`before` validates or rejects input, `after` changes data inside the request's transaction, and `modify…Response` changes the returned JSON document.

=== q adv
Why could returning a value from an API hook break things?
---
For these hooks a returned value can be treated as the result and skip remaining registered hooks and the default implementation. Return nothing (or a Status OK where expected) to let processing continue.

=== p easy
Register a hook
---
Write the hooks.json entry to run `./hooks/orderNo.js` for custom order numbers.
---
```json
{ "hooks": [ { "name": "dw.order.createOrderNo", "script": "./hooks/orderNo.js" } ] }
```
and `exports.createOrderNo = function () { return 'WEB' + … ; };`

=== p std
Add a custom field to the SCAPI basket response
---
Headless app needs `c_deliveryEstimate` on GET basket.
---
Register `dw.ocapi.shop.basket.modifyGETResponse`:
```js
exports.modifyGETResponse = function (basket, basketResponse) {
    basketResponse.c_deliveryEstimate = estimate(basket);   // keep it cheap
};
```
Return nothing so default processing continues.
