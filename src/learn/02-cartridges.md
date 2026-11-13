id: cartridges
title: Cartridges, cartridge path and SFRA
icon: packages
time: 8|5|20
summary: How code is packaged, how the cartridge path decides which file wins, and how SFRA is organised.
source: Salesforce developers: SFRA modules (module.superModule) | https://developer.salesforce.com/docs/commerce/commerce-api/guide/b2c-sfra-modules.html
source: Salesforce developers: SFRA features and components | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-sfra-features-and-comps.html

=== easy
A **cartridge** is a folder of code: controllers, templates, scripts, styles and settings. A site uses a list of cartridges called the **cartridge path**.

Think of the cartridge path as **a stack of transparent sheets**. When the site needs a file (say the product page template), it looks at the **first** sheet. If the file is there, it uses it. If not, it looks at the next sheet, and so on.

So you never edit Salesforce's base code. You put your own cartridge **in front of** it with just the files you want to change. That's called an **overlay**.

**SFRA** (Storefront Reference Architecture) is Salesforce's ready-made shop. Its main cartridge is `app_storefront_base`. Your project adds cartridges like `app_custom_mybrand` in front of it, plus integration cartridges (payments, tax) usually called `int_…` or `plugin_…`.

**Key words**
- **Cartridge:** a code package.
- **Cartridge path:** the ordered list, searched left to right.
- **Overlay:** your cartridge overriding files from a later one.
- **SFRA:** the reference storefront.

=== crash
- Cartridge path is searched **left to right**; the **first** match wins for templates, scripts, controllers and resources.
- Never modify `app_storefront_base`. Overlay it with a custom cartridge on the left.
- Typical path: `app_custom_brand:plugin_x:int_payment:app_storefront_base`.
- `require('*/cartridge/scripts/x')` searches the whole path; `require('~/cartridge/…')` means the current cartridge.
- `module.superModule` gives the **same file from the next cartridge to the right**: the basis for extending controllers and models.
- The `modules` folder (with the `server` module) sits next to the cartridges; anything in it can be required by name, for example `require('server')`.
- Business Manager has its own cartridge path, set on the Business Manager site.
- `package.json` in a cartridge points to `hooks.json` and `caches.json`. `steptypes.json` sits in the cartridge root.

=== standard
## What's in a cartridge
```
app_custom_brand/
  cartridge/
    controllers/      Product.js, Cart.js …
    models/           product/fullProduct.js …
    scripts/          helpers, hooks, job steps
    templates/default/  ISML templates
    templates/resources/  *.properties (text per locale)
    forms/default/    form definitions (XML)
    static/default/   built CSS, JS, images
    client/default/   source JS and SCSS (built with webpack)
  package.json        → "hooks": "./cartridge/scripts/hooks.json", "caches": …
```

## How the path resolves
The site's cartridge path is set in **Administration › Sites › Manage Sites › (site) › Settings**. For any lookup (`res.render('product/productDetails')`, `require('*/cartridge/models/product')`, a resource key) the platform walks the path from left to right and takes the first cartridge that has the file.

## Extending instead of copying
Copying a whole base file into your cartridge works but freezes you on that version. Prefer extending:
```js
// app_custom_brand/cartridge/models/product/fullProduct.js
var base = module.superModule;   // the same file from the next cartridge on the right
module.exports = function fullProduct(product, apiProduct, options) {
    base.call(this, product, apiProduct, options);
    product.badge = apiProduct.custom.badge || null;
    return product;
};
```
`module.superModule` returns the next matching module **to the right** of the current cartridge, or `null` if none. Chains of overlays can each call their super.

## require styles
| Style | Looks in |
|---|---|
| `require('*/cartridge/scripts/helpers/x')` | Whole cartridge path, first match |
| `require('~/cartridge/scripts/x')` | Current cartridge only |
| `require('app_storefront_base/cartridge/…')` | That named cartridge |
| `require('dw/catalog/ProductMgr')` | Platform Script API |
| `require('server')` | The `modules` folder |

## SFRA layering
- `app_storefront_base`: base storefront. Treat as read-only.
- `plugin_*`: optional features (wishlists, gift registry…).
- `int_*` / link cartridges: integrations from partners.
- `app_custom_*`: your brand code, leftmost.
- Client code is built with Node tooling (`sgmf-scripts`, webpack) into `static/`.

=== notes
- Put your custom cartridge first, then plugins and integrations, then `app_storefront_base` last.
- A template that exists in your cartridge **replaces** the base one entirely. Keep overrides small and re-check them when you upgrade SFRA.
- Don't edit the `server` module. Write your own module if you need to extend it.

=== q basic top
What is the cartridge path and how is it resolved?
---
It's the ordered list of cartridges for a site. The platform searches it from left to right and uses the first cartridge that contains the requested file, which lets custom cartridges override base ones.

=== q basic top
Why shouldn't you change app_storefront_base directly?
---
Because upgrades of SFRA would overwrite or conflict with your changes. Override or extend files from your own cartridge placed to the left, so the base stays clean and upgradable.

=== q mid top
What does module.superModule do?
---
It returns the same module (same path and name) from the next cartridge to the right on the path, or null. You use it to extend a controller or model while still running the original logic.

=== q mid top
What's the difference between `*/cartridge/...` and `~/cartridge/...` in require?
---
`*` searches the entire cartridge path and takes the first match; `~` refers to the current cartridge only.

=== q mid
Where are hooks.json and steptypes.json declared?
---
`hooks.json` (and `caches.json`) are referenced from the cartridge's `package.json`. `steptypes.json` must be in the cartridge's root folder.

=== q adv
Your override of a base template stopped picking up a new SFRA feature after an upgrade. Why, and how do you avoid it?
---
A template in your cartridge fully replaces the base one, so new markup in the base never shows. Keep overrides minimal, prefer `isinclude`/decorators and model extensions, and diff your overrides against the new base on every upgrade.

=== p easy
Which file wins?
---
Path: `app_custom:int_pay:app_storefront_base`. `product/productDetails.isml` exists in `app_custom` and `app_storefront_base`. Which one renders?
---
The one in **app_custom**, because it's first (leftmost) on the path.

=== p std
Add a field to the product model without copying it
---
Show how to add `product.badge` from a custom attribute to SFRA's full product model.
---
Create `app_custom/cartridge/models/product/fullProduct.js`:
```js
var base = module.superModule;
module.exports = function (product, apiProduct, options) {
    base.call(this, product, apiProduct, options);
    product.badge = apiProduct.custom.badge || null;
    return product;
};
```
The base model still runs; you only add your field. Templates can then read `product.badge`.
