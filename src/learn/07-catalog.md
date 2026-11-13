id: catalog
title: Products, catalogs, prices, inventory and search
icon: shirt
time: 10|5|25
summary: Product types, catalog structure, how a product becomes visible, price books, inventory and the search index.
source: Trailhead: Explore B2C Commerce catalogs | https://trailhead.salesforce.com/content/learn/modules/b2c-catalog-category-product/b2c-explore-catalogs
source: Trailhead: Configure price books | https://trailhead.salesforce.com/content/learn/modules/b2c-pricebooks-images-content/b2c-configure-price-books
source: Trailhead: Digital product data | https://trailhead.salesforce.com/content/learn/modules/cc-digital-merchandising/digital-product-data

=== easy
Picture a big warehouse list and a shop floor plan:
- The **product (master) catalog** is the warehouse list: every product and its details.
- The **storefront catalog** is the shop's floor plan: categories like "Men › Shoes". You **assign** products from the warehouse list to these categories.

Kinds of products:
- **Standard product:** sold as is.
- **Master + variants:** one T-shirt (master) with variants per size and colour. Shoppers buy a variant.
- **Product set:** a "look" of several products bought separately.
- **Bundle:** several products sold together as one item.

A **price book** holds prices in one currency. Usually a **list** price book and a **sale** price book on top of it.

**Inventory lists** hold stock per product. A site uses one list.

The **search index** is what search and category pages read. After imports, the index needs updating before changes show.

=== crash
- Two catalog roles: **master/product catalog** (owns products, not assigned to a site) and **storefront catalog** (categories, assigned to one site). A product is owned by exactly one catalog.
- Product visible on a site when: assigned to a storefront category, **online** (and within online dates), **searchable**, has a **price** (qty 1) in an active price book for the site's currency, and is in the **search index**. Availability depends on inventory and code.
- Product types: standard, **master/variant** (variation attributes like color/size), **variation group**, **product set**, **bundle**, option products (options with their own price).
- **Primary category** drives breadcrumbs; **classification category** (in the master catalog) drives attributes.
- Price books: one currency each, assigned to sites, can have a **parent** ("based on"). Sale price book on top of list price book. Price tables can be dated and tiered by quantity.
- Inventory: **inventory list** per site; records with allocation, perpetual flag, pre-order/back-order; ATS (available to sell) is computed.
- Search: `ProductSearchModel` for listing pages; refinements and sorting rules configured in Business Manager; **SearchReindex** job or incremental indexing after changes.
- Don't loop `ProductMgr.queryAllSiteProducts()` in storefront code; use search.

=== standard
## Catalogs
| Catalog | Purpose |
|---|---|
| Product (master) catalog | Owns products; mirrors the PIM; not assigned to a site |
| Storefront (site) catalog | Category tree for navigation; one per site; assigns products owned elsewhere |

A product appears in a site only when its storefront catalog assigns it to a category. Assignments can be done in Business Manager, by import (`category-assignment` in catalog.xml) or by **dynamic categorization rules** (which must be re-run after new products arrive).

## Products
- **Master** products define **variation attributes** (color, size) and their values. **Variants** are the buyable SKUs. Variation groups (a master filtered to one colour) can be used for listing pages.
- **Product set:** several products shown together, each added to cart separately.
- **Bundle:** one cart item with fixed child quantities, one price.
- **Options:** a choice on a product with its own price (gift wrap, warranty).
- Online flag and searchable flag can be **site-specific**.

## What makes a product show
1. Assigned to a storefront category of the site
2. Online, and inside online-from/to
3. Searchable (for search and category listing)
4. Priced in an active price book (currency enabled on the site) for quantity 1
5. Indexed (search index up to date)
6. Available, according to inventory and your template logic

When a product "doesn't show", check those in order.

## Price books
- One currency per book. Defined org-wide, assigned to sites.
- A sale book usually has the list book as **parent**: it only holds sale items, the rest falls back.
- Price tables can have date ranges and quantity tiers.
- In code: `product.getPriceModel().getPrice()`; SFRA's price factory builds `list` and `sales` prices for templates.
- Source codes and promotions can also influence prices; customers can get price books via customer groups (applicable price books set in code with `PriceBookMgr.setApplicablePriceBooks`).

## Inventory
- An **inventory list** per site (Site preferences › Inventory). Records: allocation, perpetual, pre-order/back-order handling, in-stock date.
- `product.getAvailabilityModel()` gives `isInStock()`, `getInventoryRecord()`, `getAvailabilityStatus()`.
- Inventory is **reserved** when an order is created from a basket (or earlier if you reserve the basket), and released if the order fails.

## Search
```js
var ProductSearchModel = require('dw/catalog/ProductSearchModel');
var psm = new ProductSearchModel();
psm.setCategoryID('mens-shoes');
psm.setSearchPhrase('running');
psm.setOrderableProductsOnly(true);
psm.search();
var hits = psm.getProductSearchHits();
```
SFRA wraps this in `search/productSearch` models with refinements and paging. Indexing runs incrementally or with the **SearchReindex** job. Refinements, sorting rules, synonyms and boosting live in Business Manager › Search.

=== notes
- "Product missing on the site" is almost always: no storefront category assignment, offline, no price, or index not rebuilt.
- Use search (indexed) for listings; avoid loading thousands of products through ProductMgr in a request.
- Variants are what get added to the cart, not masters.

=== q basic top
What's the difference between a master catalog and a storefront catalog?
---
The master (product) catalog owns the products and their data. The storefront catalog holds the navigation categories, is assigned to a site, and assigns products from the master catalog to its categories.

=== q basic top
What conditions must a product meet to appear on a site?
---
Assigned to a category in the site's storefront catalog, online (within dates), searchable for listings, priced for quantity 1 in an active price book for the site currency, and present in the search index. Inventory may further decide whether it can be bought.

=== q mid top
Master, variant, set and bundle: explain each.
---
A master defines variation attributes and isn't bought directly; variants are the purchasable combinations. A set groups products that are bought separately. A bundle is one cart item made of fixed child products with one price.

=== q mid top
How do list and sale price books work together?
---
Each has one currency. The sale book is "based on" (parent) the list book and only contains reduced items. Both are assigned to the site; the storefront shows the sale price where it exists and the list price otherwise.

=== q mid
What is the primary category used for?
---
It defines the product's main storefront category, used for breadcrumbs and canonical navigation. Without it the classification category is used.

=== q mid
Why use ProductSearchModel instead of ProductMgr for a category page?
---
ProductSearchModel reads the search index, is fast, supports refinements, sorting and paging, and only returns visible products. Loading many products through ProductMgr is slow and can hit quotas.

=== q adv
New products were imported but don't appear in search. What do you check?
---
Category assignment in the storefront catalog, online/searchable flags (site-specific), prices in an active price book for the site currency, and whether indexing ran (incremental or SearchReindex job). Also check the import log for errors and that the import ran on the right instance.

=== p easy
Find the buyable item
---
A shopper picks "Red, size M" of a T-shirt. What's added to the cart: the master or a variant?
---
The **variant** that has color=Red and size=M. Masters can't be bought directly.

=== p std
Debug a missing product
---
Product `SKU-9` exists in Business Manager but doesn't show on the site's category page. Give a checklist with where to look.
---
1. Storefront catalog: is SKU-9 assigned to that category? (Catalogs › category › Products)
2. Product: online for this site, searchable, inside online dates?
3. Price: a quantity-1 price in an active, site-assigned price book of the site currency?
4. Variants: for a master, are variants online and priced?
5. Search index: run or check incremental indexing (Search › Search Indexes) or the SearchReindex job.
6. Inventory: if the listing filters to orderable products, is there stock (or perpetual)?
7. Caching: the category page may be cached; wait or invalidate.
