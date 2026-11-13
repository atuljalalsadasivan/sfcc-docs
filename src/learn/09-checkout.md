id: checkout
title: Basket, checkout and orders
icon: coins
time: 10|5|25
summary: Basket calculation, order creation and placement, payment, statuses and export.
source: Script API: OrderMgr | https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-script-api/dw.order.OrderMgr.html
source: Salesforce developers: Order management for developers | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-order-management-for-developers.html
source: Commerce API: Orders | https://developer.salesforce.com/docs/commerce/commerce-api/references/orders

=== easy
The **basket** is the shopping cart. Every time it changes, SFCC **recalculates** it: prices, promotions, shipping, tax, totals.

Checkout in SFRA goes: shipping address and method → billing and payment → place order.

Placing an order is three steps:
1. **Create** the order from the basket (status CREATED, stock is reserved, basket is gone).
2. **Authorise** the payment with the payment provider.
3. If payment is OK: **place** the order (status NEW). If not: **fail** it (status FAILED, stock released, basket restored).

After that, the order is **exported** to the warehouse or order system. Its **export status** tracks that.

=== crash
- Basket recalculation: `HookMgr.callHook('dw.order.calculate', 'calculate', basket)` → shipping, promotions (`PromotionMgr.applyDiscounts`), tax (`dw.order.calculateTax`), totals.
- Order flow: `OrderMgr.createOrder(basket)` → payment authorisation (payment processor hook) → `OrderMgr.placeOrder(order)` or `OrderMgr.failOrder(order, true)`.
- `createOrder` → status **CREATED**, inventory reserved, basket removed. Can throw `CreateOrderException`.
- `placeOrder` → status **NEW** (shown as OPEN later), invoice number, coupon redemptions recorded. Usually then set export status **READY** and confirmation status **CONFIRMED**.
- `failOrder(order, true)` → **FAILED**, inventory released, basket reopened (true = reopen).
- Other statuses: OPEN, COMPLETED, CANCELLED (`cancelOrder`), REPLACED. Export status: NOT_EXPORTED, READY, EXPORTED, FAILED. Payment status: NOTPAID, PARTPAID, PAID. Shipping status, confirmation status.
- Payment: **payment methods** (what shopper picks) map to **payment processors** (who handles it). SFRA calls `hooks.json` entries like `app.payment.processor.<processor_id>` with `Handle` and `Authorize`.
- All order writes inside transactions. Guard against double submit (place order only once, check order status).
- Asynchronous payments (redirect to PayPal and back): order stays CREATED until the return; fail it if the shopper abandons.

=== standard
## Basket calculation
SFRA calls `basketCalculationHelpers.calculateTotals(basket)`, which calls the `dw.order.calculate` hook. The default implementation:
1. Calculates product prices and shipping (`dw.order.calculateShipping`)
2. Applies promotions (`PromotionMgr.applyDiscounts`)
3. Calculates tax (`dw.order.calculateTax`)
4. Updates totals

Override parts by registering your own hooks (for example external tax) instead of rewriting the controller.

## Placing an order (SFRA CheckoutServices-PlaceOrder, simplified)
```js
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');

// validate basket, addresses, payment, inventory …
var order;
try {
    order = Transaction.wrap(function () { return OrderMgr.createOrder(basket); });   // CREATED
} catch (e) { /* CreateOrderException: show error */ }

var auth = COHelpers.handlePayments(order, order.orderNo);      // calls processor hooks
if (auth.error) {
    Transaction.wrap(function () { OrderMgr.failOrder(order, true); });             // FAILED, basket reopened
    return error();
}

var placed = Transaction.wrap(function () {
    var status = OrderMgr.placeOrder(order);                                          // NEW
    if (status.isError()) { throw new Error('place failed'); }
    order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
    order.setExportStatus(Order.EXPORT_STATUS_READY);
});
```
(`COHelpers` = `*/cartridge/scripts/checkout/checkoutHelpers`.)

## Statuses
| Field | Values |
|---|---|
| Order status | CREATED, NEW, OPEN, COMPLETED, CANCELLED, FAILED, REPLACED |
| Export status | NOT_EXPORTED, READY, EXPORTED, FAILED |
| Payment status | NOTPAID, PARTPAID, PAID |
| Confirmation | NOTCONFIRMED, CONFIRMED |
| Shipping | NOTSHIPPED, PARTSHIPPED, SHIPPED |

Export jobs pick orders with export status READY and set EXPORTED after sending them to the order or warehouse system.

## Payments
- Business Manager: **Payment Processors** and **Payment Methods** (method → processor, per site).
- SFRA: each processor ID has hooks in `hooks.json`, for example `app.payment.processor.basic_credit` with `Handle` (store payment info in the basket) and `Authorize` (call the provider, set transaction ID).
- Never store full card data. Use tokens from the provider (PCI).

## Pitfalls
- Double clicks creating two orders: disable the button and make the server check the basket/order state.
- Inventory: reserved at order creation; failing the order releases it. Optionally reserve earlier with `basket.reserveInventory()`.
- Asynchronous payments: keep the order CREATED while the shopper is away, then place or fail it on return or with a cleanup job.

=== notes
- createOrder before payment, placeOrder after successful payment, failOrder if payment fails.
- Always recalculate the basket after any change; never trust totals sent from the browser.
- Set export status READY when the order is ready for downstream systems.

=== q basic top
Describe the order placement flow.
---
Validate the basket, create the order with `OrderMgr.createOrder` (status CREATED, inventory reserved), authorise payment, then `OrderMgr.placeOrder` on success (status NEW) or `OrderMgr.failOrder` on failure (status FAILED, basket reopened). Then set confirmation and export statuses.

=== q basic top
What does dw.order.calculate do?
---
It's the hook that recalculates a basket: shipping, promotions, tax and totals. SFRA calls it after every basket change.

=== q mid top
What's the difference between order status and export status?
---
Order status is the order's lifecycle (CREATED, NEW, OPEN, COMPLETED, CANCELLED, FAILED). Export status tracks whether it has been sent to downstream systems (NOT_EXPORTED, READY, EXPORTED, FAILED).

=== q mid top
How are payment methods and processors connected in SFRA?
---
In Business Manager each payment method points to a payment processor. SFRA calls hooks registered as `app.payment.processor.<processorId>` with `Handle` and `Authorize` functions.

=== q mid
What happens when you call failOrder(order, true)?
---
The order becomes FAILED, reserved inventory and coupon redemptions are released, and with `true` the basket is reopened so the shopper can retry.

=== q adv
How do you prevent duplicate orders from a double click?
---
Disable the button client-side, and on the server check that the basket still exists and hasn't been converted (createOrder removes it), use the order token/number, and make the payment call idempotent with the provider if possible.

=== q adv
How would you integrate an external tax service?
---
Implement the `dw.order.calculateTax` hook in your cartridge to call the tax service (through the service framework with a timeout and fallback) and set taxes on line items, keeping the rest of the default calculation.

=== p easy
Which status?
---
Payment was declined after createOrder. What do you call and what status does the order get?
---
`OrderMgr.failOrder(order, true)` inside a transaction. Status **FAILED**; the basket is reopened.

=== p std
Order export job
---
Write the core of a job step that exports READY orders and marks them EXPORTED.
---
```js
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
exports.execute = function () {
    var orders = OrderMgr.searchOrders('exportStatus = {0} AND status != {1}', 'creationDate asc', Order.EXPORT_STATUS_READY, Order.ORDER_STATUS_FAILED);
    while (orders.hasNext()) {
        var o = orders.next();
        var ok = sendToOms(o);                 // service call
        Transaction.wrap(function () { o.setExportStatus(ok ? Order.EXPORT_STATUS_EXPORTED : Order.EXPORT_STATUS_FAILED); });
    }
    orders.close();
};
```
For big volumes use a chunk-oriented step instead.
