id: datamodel
title: Data model: system objects, custom attributes, custom objects, preferences
icon: listCheck
time: 7|4|18
summary: Where data lives and how to extend it.
source: XML schemas (metadata, customobject) | https://salesforcecommercecloud.github.io/b2c-dev-doc/docs/current/xsd/
source: Salesforce developers: Governance and quotas | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-governance-and-quotas.html

=== easy
SFCC already has built-in data types, called **system objects**: Product, Category, Customer, Order, Basket, Site and more.

When you need an extra field, say "fabric" on Product, you add a **custom attribute** in Business Manager. Code reads it as `product.custom.fabric`.

When you need a completely new kind of record, say "store events" or "newsletter sign-ups", you create a **custom object type**: your own small table.

**Site preferences** are settings that change shop behaviour without new code, like a free-shipping limit. They're custom attributes on the special system object `SitePreferences`.

**Key words**
- **System object:** built-in type.
- **Custom attribute:** an extra field on a type.
- **Custom object:** your own type of record.
- **Attribute group:** groups fields so they show up in Business Manager.

=== crash
- Extend system objects with custom attributes in **Administration › Site Development › System Object Types**.
- New attributes must be added to an **attribute group** to appear in Business Manager edit screens.
- Attribute types: string, text, html, int, double, boolean, date, datetime, email, password, image, enum-of-string/int, set-of-string/int/double.
- Options: **localizable** (per locale), **site-specific** (product attributes per site), mandatory, externally managed.
- Custom objects: **Custom Object Types**; key attribute; **storage scope** organization or site; data replication can include them; set a **retention** (days) for temporary data.
- Code: `CustomObjectMgr.createCustomObject(type, key)`, `getCustomObject`, `queryCustomObjects(type, query, sort, …)`, `remove`.
- Deploy definitions as **metadata XML** in a site import (`meta/system-objecttype-extensions.xml`, `custom-objecttype-definitions.xml`), not by clicking on each instance.
- Quotas limit attributes per object type and custom-object counts. Don't use custom objects as a big database or a log.
- Site preferences: `Site.getCurrent().getCustomPreferenceValue('id')`.

=== standard
## System objects
Built-in types with system attributes (`Product.name`, `Order.orderNo`). You can't remove system attributes, but you can add custom ones to most types: Product, Category, Customer Profile, Order, Basket, ProductLineItem, Store, SitePreferences and more.

## Custom attributes
Created under System Object Types › (type) › Attribute Definitions:
- **Type** decides storage and editing (string, enum-of-string, set-of-string, boolean, date, html …).
- **Localizable:** one value per locale; read in code for the request locale automatically.
- **Site-specific** (some product attributes): different value per site.
- **Externally managed:** not editable in Business Manager, only by import.
- Add the attribute to an **Attribute Group** to see it in Business Manager.

Access: `product.custom.fabric`, `order.custom.erpId = 'X'` (inside a transaction).

## Custom objects
For business data with no system type: store locator extras, sign-ups, integration queues, redirects.
- Defined in Custom Object Types with a **key attribute** (string or int) and custom attributes.
- **Storage scope:** site or organization.
- **Data replication** setting: replicable or not.
- **Retention days**: the platform deletes old instances automatically. Use this for temporary or log-like data.

```js
var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var it = CustomObjectMgr.queryCustomObjects('StoreEvent', 'custom.storeId = {0} AND custom.date > {1}', 'custom.date asc', storeId, new Date());
while (it.hasNext()) { var ev = it.next(); /* … */ }
it.close();
```
Always close iterators from queries.

## Deploying metadata
Put definitions in source control as XML (metadata schema) and import with a site archive or the CLI. Clicking them in by hand on each instance leads to drift. Data replication from staging can also carry them.

## Limits
Object and attribute counts are under quotas. Custom objects are not meant for millions of rows or high-frequency writes from the storefront. Prefer an external system or batch jobs for that.

=== notes
- Add new attributes to an attribute group or merchants won't see them.
- Keep metadata in XML in your repository and import it; don't hand-create on each instance.
- Use retention days on custom objects that are temporary.

=== q basic top
What's the difference between a custom attribute and a custom object?
---
A custom attribute adds a field to an existing type (like Product). A custom object type is a new type of record with its own key and attributes.

=== q basic top
How do you read a site preference in code?
---
`Site.getCurrent().getCustomPreferenceValue('prefId')`. Site preferences are custom attributes of the SitePreferences system object.

=== q mid top
How do you move new attributes and custom object types between instances?
---
Export or keep them as metadata XML (system object extensions and custom object type definitions) and import via site import/CLI, or replicate from staging. Avoid manual re-creation per instance.

=== q mid
Why might a new product attribute not show in Business Manager?
---
It hasn't been added to an attribute group for the Product type.

=== q mid
What is a localizable attribute?
---
An attribute that stores one value per locale; code reading it gets the value for the current request locale (with fallback).

=== q adv
A team wants to log every add-to-cart event in a custom object. Good idea?
---
No. Custom objects are under quotas and storefront writes add transactions on a hot path. Send events to an analytics or external system (client-side or async job), or at least set retention and batch the writes.

=== p easy
Pick the right tool
---
Marketing wants a "Season" field on products. Custom attribute or custom object?
---
A **custom attribute** on the Product system object, ideally an enum-of-string with allowed values, added to an attribute group.

=== p std
Design store events
---
Stores host events (date, title, store ID). Pages show upcoming events per store. Model it.
---
Custom object type `StoreEvent`, key = generated ID string, attributes `storeId`, `date` (datetime), `title` (localizable string), site-scoped, retention for past events. Query with `queryCustomObjects('StoreEvent', 'custom.storeId = {0} AND custom.date > {1}', 'custom.date asc', id, now)`, close the iterator, and cache the result for the store page.
