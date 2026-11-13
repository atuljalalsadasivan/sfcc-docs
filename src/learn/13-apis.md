id: apis
title: Headless: OCAPI, SCAPI and SLAS
icon: braces
time: 8|4|20
summary: The two API families, shopper login (SLAS), hooks and custom APIs, and when to use what.
source: Salesforce developers: Get started with SCAPI | https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/scapi-get-started.html
source: Salesforce developers: Why use SCAPI instead of OCAPI | https://developer.salesforce.com/docs/commerce/sfra/guide/why-use-scapi.html
source: Salesforce developers: SLAS overview | https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas.html
source: Salesforce developers: Custom APIs | https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/custom-apis.html

=== easy
Besides SFRA web pages, SFCC can be used **headless**: another front end (a React site, a mobile app) talks to SFCC only through **APIs**.

Two API families:
- **OCAPI** (Open Commerce API), the older one: **Shop API** for shopper actions, **Data API** for admin work, **Meta API** for descriptions.
- **SCAPI** (B2C Commerce API), the newer one and the default for new work: **Shopper APIs** (browse, cart, checkout) and **Admin APIs** (manage products, orders…), plus **Custom APIs** you write yourself.

Shoppers log in to SCAPI through **SLAS** (Shopper Login and API Access Service), which hands out tokens using OAuth.

The **Composable Storefront** (PWA Kit) is Salesforce's React storefront built on the Shopper APIs.

=== crash
- OCAPI: Shop / Data / Meta APIs; configured with **OCAPI settings JSON** in Business Manager (per client ID: allowed resources and methods). Client IDs from Account Manager. Not the default for new projects.
- SCAPI: **Shopper APIs** (customer-facing, auth via **SLAS**) and **Admin APIs** (merchant/back-office, auth via **Account Manager** client credentials). Short code + organization ID in the URL. Rate limited; shopper calls have a response timeout (10 s).
- **SLAS clients:** **public** (no secret, can't keep secrets: SPA, mobile) use `authorization_code_pkce`; **private** (BFF/server) use `client_credentials` for guests and PKCE for registered logins. `channel_id` (site) is required for guest tokens.
- Tokens: short-lived access token (JWT) + refresh token.
- Extend: **hooks** (`dw.ocapi.shop.*` names, used by both families) and **Custom APIs** (OAS 3 contract + script + `api.json` in a cartridge, Shopper or Admin type).
- Shopper custom API endpoints need `siteId`; Admin ones must not have it and the cartridge must be on the Business Manager site path.
- Hybrid storefronts (part SFRA, part composable) share sessions via **hybrid auth** / session bridge.
- You can't use one API client ID for both OCAPI and SCAPI.

=== standard
## Families
| | OCAPI | SCAPI |
|---|---|---|
| Since | 2014 | 2020 |
| Groups | Shop, Data, Meta | Shopper, Admin, Custom |
| Shopper auth | OCAPI JWT / session | SLAS (OAuth 2.1, refresh tokens) |
| Admin auth | Account Manager client | Account Manager client |
| Config | OCAPI settings JSON in BM | API client roles, SLAS client config |
| Extend | Hooks | Hooks + Custom APIs |

New projects should default to SCAPI. OCAPI is still used for some Data API tasks and existing integrations.

## SLAS in practice
- **Public client** (browser SPA, mobile app): no secret; guest and registered logins use `authorization_code_pkce` (code verifier and challenge).
- **Private client** (server or backend-for-frontend): has a secret; guest tokens with `client_credentials` (plus `channel_id`), registered logins with PKCE; trusted system flows for acting on behalf of a shopper.
- Refresh tokens keep sessions alive; rotate guest sessions after an order.

## Calling a Shopper API (conceptually)
```
POST https://{shortCode}.api.commercecloud.salesforce.com/shopper/auth/v1/organizations/{orgId}/oauth2/token
  grant_type=client_credentials&channel_id=RefArch   (private client, Basic auth with id:secret)

GET  https://{shortCode}.api.commercecloud.salesforce.com/product/shopper-products/v1/organizations/{orgId}/products/{id}?siteId=RefArch
  Authorization: Bearer <access_token>
```

## Hooks for APIs
`before…` / `after…` / `modify…Response` hooks with `dw.ocapi.shop.*` names run for both families: validate input, change data, or add `c_` fields to responses.

## Custom APIs
A cartridge contains `rest-apis/<api-name>/` with `schema.yaml` (OpenAPI 3 contract), `api.json` (maps endpoints to script functions) and the script. Deployed with the code version; endpoints appear under `/custom/<api-name>/v1/…`. Shopper custom APIs use SLAS tokens and require `siteId`; Admin custom APIs use Account Manager tokens.

=== notes
- Public vs private SLAS client is decided by one question: can the app keep a secret safe?
- Use Admin APIs only from back-end systems; never ship admin credentials to a browser.
- Rate limits and timeouts apply: cache on your side and batch calls.

=== q basic top
What's the difference between OCAPI and SCAPI?
---
OCAPI is the older REST API (Shop, Data, Meta) configured via OCAPI settings. SCAPI is the newer API family (Shopper, Admin, Custom APIs) with SLAS OAuth for shoppers; it's the default for new headless work.

=== q basic top
What is SLAS?
---
Shopper Login and API Access Service: the OAuth service that issues access and refresh tokens to shoppers (guest or registered) for the SCAPI Shopper APIs.

=== q mid top
When do you use a public vs a private SLAS client?
---
Public when the app can't keep a secret (single-page web app, mobile app): it uses PKCE. Private when a trusted server or BFF holds the secret: it can use client_credentials for guests.

=== q mid top
How do you extend SCAPI?
---
With hooks (before/after/modifyResponse on existing endpoints) and with Custom APIs: an OAS 3 contract plus script implementation in a cartridge, exposed as new endpoints.

=== q mid
How is OCAPI access controlled?
---
Through OCAPI settings (JSON) in Business Manager, global or per site, listing for each client ID which resources and methods are allowed.

=== q adv
A team plans to call Admin APIs from the browser to update a wishlist. Problem?
---
Admin APIs need Account Manager credentials that must never be exposed to browsers. Use Shopper APIs (Shopper Product Lists) with SLAS tokens, or a Shopper Custom API, or a BFF that holds credentials.

=== p easy
Pick the API
---
A mobile app needs product search and a cart. Which API group and auth?
---
**SCAPI Shopper APIs** (Shopper Search, Shopper Baskets) with a **SLAS public client** using PKCE.

=== p std
Expose loyalty points headlessly
---
The composable storefront must show a shopper's loyalty points stored in an external system.
---
Create a **Shopper Custom API** `loyalty` in a cartridge: `schema.yaml` with `GET /customers/{customerId}/points`, `api.json` mapping to `loyalty.js`, which checks the SLAS token's customer matches, calls the loyalty service via LocalServiceRegistry (timeout, circuit breaker) and returns `{ points }`. Cache briefly where possible. Call it with `siteId`.
