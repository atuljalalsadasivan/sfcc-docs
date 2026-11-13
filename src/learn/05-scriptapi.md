id: scriptapi
title: Script API, models and transactions
icon: braces
time: 10|5|25
summary: The dw.* packages, SFRA models, Transaction.wrap, and logging.
source: Script API reference | https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/scriptapi/html/index.html
source: Salesforce developers: SFRA features and components | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-sfra-features-and-comps.html

=== easy
The **Script API** is SFCC's built-in library, written as JavaScript modules starting with `dw/`. You `require` what you need:
- `dw/catalog/ProductMgr`: find products.
- `dw/order/BasketMgr`: the shopper's cart (called a **basket**).
- `dw/customer/CustomerMgr`: customers.
- `dw/system/Site`: the current site and its settings.
- `dw/system/Transaction`: save changes.

**Saving data needs a transaction.** Reading is free, but if you change anything stored (a basket, a customer, a custom object), wrap it:
```js
Transaction.wrap(function () { basket.setCustomerEmail(email); });
```
If something fails inside, all changes are undone.

**Models** in SFRA turn platform objects into plain data for templates, like a translator: the template gets `product.price.sales.formatted` instead of calling platform objects itself.

=== crash
- Server-side JavaScript (CommonJS `require`), with ES5-ish syntax plus some newer features; no Node modules or browser APIs.
- Key managers: `ProductMgr`, `CatalogMgr`, `BasketMgr`, `OrderMgr`, `CustomerMgr`, `CustomObjectMgr`, `PromotionMgr`, `ShippingMgr`, `PaymentMgr`, `HookMgr`, `CacheMgr`, `Site`, `URLUtils`, `Resource`, `Logger`, `Transaction`.
- Writes to persistent objects need `Transaction.wrap(fn)` (or `begin`/`commit`/`rollback`). Errors inside roll back everything.
- Keep transactions small; huge transactions in jobs cause locking and quota problems.
- SFRA **models** (`cartridge/models`) convert API objects to plain JSON-like objects; templates and `res.json` use models, not API objects.
- Custom attributes: `object.custom.myAttr`.
- Site preferences: `Site.getCurrent().getCustomPreferenceValue('id')`.
- Logging: `Logger.getLogger('fileprefix', 'category').info(...)`. Custom log files appear as `custom-fileprefix-…log`.
- Collections are platform types: use `.toArray()`, iterators, or `collections` helper in SFRA.

=== standard
## Packages you'll use daily
| Package | Highlights |
|---|---|
| `dw.catalog` | `ProductMgr.getProduct(id)`, `CatalogMgr.getCategory(id)`, `ProductSearchModel`, `PriceBookMgr` |
| `dw.order` | `BasketMgr.getCurrentBasket()` / `getCurrentOrNewBasket()`, `OrderMgr`, `ShippingMgr`, `PaymentMgr` |
| `dw.customer` | `CustomerMgr`, `customer.profile`, address book |
| `dw.campaign` | `PromotionMgr`, active promotions and plans |
| `dw.object` | `CustomObjectMgr`, system object metadata |
| `dw.system` | `Site`, `Transaction`, `Logger`, `HookMgr`, `CacheMgr`, `Status` |
| `dw.web` | `URLUtils`, `Resource`, `Forms`, `CSRFProtection` |
| `dw.svc` | `LocalServiceRegistry` for web services |
| `dw.io` | `File`, `FileReader/Writer`, `XMLStreamReader/Writer`, `CSVStreamReader` |
| `dw.util` | `Calendar`, `StringUtils`, `HashMap`, `ArrayList`, `Template` |

## Transactions
```js
var Transaction = require('dw/system/Transaction');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');

Transaction.wrap(function () {
    var co = CustomObjectMgr.createCustomObject('NewsletterSignup', email);
    co.custom.source = 'footer';
});
```
- Anything changing persistent data must be inside a transaction.
- An exception inside `wrap` rolls the whole transaction back and re-throws.
- In jobs, commit in batches (for example per 100 items). One transaction over 100 000 items can fail on size limits and locks the objects for a long time.

## Models
SFRA builds view objects with models and decorators:
```js
var ProductFactory = require('*/cartridge/scripts/factories/product');
var product = ProductFactory.get({ pid: req.querystring.pid });
res.render('product/productDetails', { product: product });
```
Factories pick the right model (simple, variant, set, bundle) and decorators add parts (price, images, availability, promotions). Extend them with `module.superModule` (see the Cartridges lesson).

## Custom attributes and preferences
```js
var Site = require('dw/system/Site');
var freeShipFrom = Site.getCurrent().getCustomPreferenceValue('freeShippingThreshold');
var colour = apiProduct.custom.colourFamily;    // custom attribute on Product
```

## Logging
```js
var log = require('dw/system/Logger').getLogger('payment', 'adyen');
log.info('Auth for order {0} returned {1}', order.orderNo, result.status);
log.error('Auth failed: {0}', e.message);
```
Never log card data, passwords or full personal data. Set log levels per category in Business Manager (Custom Log Settings).

=== notes
- Read freely, write only inside `Transaction.wrap`.
- Don't pass API objects to the browser: pass models.
- Avoid expensive calls in loops (for example `ProductMgr.getProduct` for every search hit when the search hit already has the data).

=== q basic top
Why do you need Transaction.wrap?
---
Changes to persistent objects (basket, customer, custom objects, orders) must happen inside a transaction. `Transaction.wrap` commits on success and rolls everything back if the function throws.

=== q basic top
What is a model in SFRA?
---
A JavaScript module that converts platform API objects into plain objects for templates and JSON responses, so templates don't call the Script API directly.

=== q basic
How do you read a custom attribute and a site preference?
---
Custom attribute: `object.custom.attributeId`. Site preference: `Site.getCurrent().getCustomPreferenceValue('prefId')`.

=== q mid top
What happens if an exception is thrown inside Transaction.wrap?
---
The transaction is rolled back, so none of the changes in that function are saved, and the exception is re-thrown to the caller.

=== q mid
getCurrentBasket vs getCurrentOrNewBasket?
---
`getCurrentBasket()` returns the existing basket or null. `getCurrentOrNewBasket()` creates one if needed, so use it only when you really need a basket (for example adding to cart), not for just reading.

=== q mid
How do you write to your own log file?
---
`Logger.getLogger('prefix', 'category')` writes to `custom-prefix-*.log`; use info/warn/error/debug and configure levels in Business Manager.

=== q adv
A job updates 200 000 custom objects in one transaction and fails. What's wrong and what's the fix?
---
One huge transaction hits size limits, holds locks and can trigger quota errors. Process in chunks (chunk-oriented job step) or commit every N objects with separate transactions.

=== p easy
Save an email
---
Save the newsletter email into custom object type `NewsletterSignup` (key = email).
---
```js
var Transaction = require('dw/system/Transaction');
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
Transaction.wrap(function () {
    CustomObjectMgr.createCustomObject('NewsletterSignup', email);
});
```

=== p std
Safe update with error handling
---
Set `basket.custom.giftMessage` from a form and return JSON success or error.
---
```js
server.post('SaveGiftMessage', csrfProtection.validateAjaxRequest, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');
    var basket = BasketMgr.getCurrentBasket();
    if (!basket) { res.json({ success: false, error: 'No basket' }); return next(); }
    try {
        Transaction.wrap(function () { basket.custom.giftMessage = (req.form.message || '').substring(0, 200); });
        res.json({ success: true });
    } catch (e) {
        require('dw/system/Logger').error('Gift message failed: {0}', e.message);
        res.json({ success: false, error: 'Could not save' });
    }
    next();
});
```
