id: promotions
title: Campaigns, promotions and coupons
icon: speakerphone
time: 7|4|18
summary: How discounts are configured, qualified, ordered and applied in code.
source: Trailhead: Explore campaigns and experience types | https://trailhead.salesforce.com/content/learn/modules/b2c-campaigns-and-promotions/b2c-explore-campaigns-and-experience-types
source: Trailhead: Campaigns and promotions | https://trailhead.salesforce.com/content/learn/modules/cc-digital-merchandising/digital-campaigns-and-promotions
source: Salesforce developers: Customize promotions | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-promotions-for-developers.html

=== easy
A **campaign** is like a marketing event, say "Summer sale, 1–15 July". Inside it are **promotions**, the actual discount rules: "20% off shoes", "free shipping over 50".

Who gets the discount is decided by **qualifiers**:
- a **coupon** code the shopper types,
- a **customer group** (for example "registered customers" or "VIP"),
- a **source code** (the shopper came from a partner link or ad).

There are three kinds of promotions, applied in this order:
1. **Product** promotions (on items),
2. **Order** promotions (on the total),
3. **Shipping** promotions.

**Rank** and **exclusivity** stop too many discounts stacking up.

=== crash
- Campaign = schedule + qualifiers + experiences (promotions, content slots, sorting rules). Disabled campaign → its promotions are inactive.
- Qualifiers: **coupons**, **customer groups** (built-in: Everyone, Registered, Unregistered), **source codes**.
- Classes applied in order: **product → order → shipping**.
- **Exclusivity:** no exclusivity, class (exclusive within its class), global (exclusive over all). **Rank:** smaller number = higher priority.
- Coupon types: single code, multiple listed codes, system-generated codes; limits per code, per customer, per time frame.
- In code, discounts are applied in the **calculate** flow: `PromotionMgr.applyDiscounts(basket)` inside the `dw.order.calculate` hook (SFRA's `basketCalculationHelpers.calculateTotals`).
- Add a coupon: `basket.createCouponLineItem(code, true)` inside a transaction, then recalculate. Catch `CreateCouponLineItemException` for invalid codes.
- Approaching (upsell) discounts: `PromotionMgr.getDiscounts(basket).getApproachingOrderDiscounts()` for "spend X more" messages.
- Promotions in a listing price need promotion-aware caching (`cache.applyPromotionSensitiveCache`).

=== standard
## Building blocks
| Object | Holds |
|---|---|
| Campaign | Schedule, qualifiers, customer groups, coupons, source codes; contains experiences |
| Promotion | Class, condition (what qualifies), discount (what is given), exclusivity, rank, its own qualifiers |
| Coupon | Codes and redemption limits; used as a qualifier |
| Customer group | Static list or dynamic rule |
| Source code group | Codes from affiliates, ads, catalogs |

A promotion inherits the campaign's schedule and qualifiers and can only narrow them.

## Order of application
1. **Class:** product, then order (on the subtotal after product discounts), then shipping.
2. **Exclusivity:** whether others in the same class (or any class) can combine.
3. **Rank:** lower number wins when they compete.
4. **Discount type and value** decide among equal rank.

## In code
Discounts are recalculated whenever the basket changes:
```js
// inside dw.order.calculate (SFRA: cartridge/scripts/hooks/cart/calculate.js)
var PromotionMgr = require('dw/campaign/PromotionMgr');
PromotionMgr.applyDiscounts(basket);
```
Adding a coupon in a controller:
```js
var Transaction = require('dw/system/Transaction');
var HookMgr = require('dw/system/HookMgr');
try {
    Transaction.wrap(function () {
        basket.createCouponLineItem(code, true);
        HookMgr.callHook('dw.order.calculate', 'calculate', basket);
    });
} catch (e) {
    // e.errorCode: COUPON_CODE_UNKNOWN, COUPON_DISABLED, CODE_ALREADY_IN_BASKET, REDEMPTION_LIMIT_EXCEEDED …
}
```
Showing promotions on a product page: `PromotionMgr.getActiveCustomerPromotions().getProductPromotions(product)`.

## Caching
If prices on cached pages include promotions, use promotion-sensitive caching so pages vary by active promotions, or load promotional prices separately.

## Imports
Campaigns, promotions and promotion-campaign assignments come in `promotion.xml`; coupons in `coupon.xml`; customer groups in `customergroup.xml`. Import qualifiers first.

=== notes
- A promotion without a promotion-campaign assignment never runs.
- Always recalculate the basket after adding or removing coupons.
- Use rank and exclusivity on purpose; "stacking" bugs are a classic production incident.

=== q basic top
What are the three promotion classes and in what order are they applied?
---
Product, then order, then shipping. Order promotions use the subtotal after product discounts.

=== q basic top
What qualifiers can a campaign or promotion use?
---
Coupons, customer groups and source codes (plus the schedule).

=== q mid top
What do rank and exclusivity do?
---
Exclusivity says whether a promotion can combine with others in its class or globally; rank (smaller is stronger) decides which wins when promotions compete.

=== q mid top
How are promotions applied in code?
---
In the basket calculation (`dw.order.calculate` hook) via `PromotionMgr.applyDiscounts(basket)`, which runs after every basket change.

=== q mid
How do you add a coupon to the basket?
---
Inside a transaction call `basket.createCouponLineItem(code, true)`, recalculate the basket, and catch `CreateCouponLineItemException` to show the error code.

=== q adv
Prices on a cached category page show the wrong promotional price for some shoppers. Why?
---
The page was cached for one promotion context and served to others. Use promotion-sensitive caching, vary by price book/promotion, or move promotional price display into a remote include or AJAX.

=== p easy
Order of discounts
---
Cart has 20% off shoes (product) and 10 off orders over 100 (order). Shoes cost 125. What's the total?
---
Product discount first: 125 − 25 = 100. Order promotion checks the new subtotal (100): it qualifies, so 100 − 10 = **90** (plus shipping).

=== p std
"Spend X more" message
---
Show "Add 15.00 more for free shipping" in the cart.
---
```js
var PromotionMgr = require('dw/campaign/PromotionMgr');
var discounts = PromotionMgr.getDiscounts(basket);
var approaching = discounts.getApproachingShippingDiscounts(basket.defaultShipment);
// each item: getDistanceFromConditionThreshold(), getDiscount().getPromotion().calloutMsg
```
Map them into the cart model and render the distance with the currency formatter.
