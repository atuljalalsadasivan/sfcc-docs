id: isml
title: ISML templates
icon: fileCode
time: 8|5|20
summary: Printing safely, includes, decorators, page caching tags, slots and resource text.
source: Salesforce developers: Content cache | https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-content-cache.html
source: Salesforce developers: Caching strategies | https://developer.salesforce.com/docs/commerce/sfra/guide/caching-strategies-sk.html

=== easy
**ISML** is SFCC's template language: normal HTML plus special `<is…>` tags and `${ … }` expressions.

- `${pdict.product.name}` prints a value. **pdict** is the data the controller sent.
- `<isif condition="${…}"> … <iselse> … </isif>` shows parts only when something is true.
- `<isloop items="${list}" var="item"> … </isloop>` repeats for each item.
- `<isinclude template="…"/>` pulls in another template, like a reusable piece.
- `<isdecorate template="common/layout/page">` wraps your page in a layout (header and footer) and the layout shows your content where it has `<isreplace/>`.
- `<isprint value="${…}"/>` prints with safe encoding, so a shopper's text can't inject scripts.
- `Resource.msg('key', 'file', null)` gets translated text from `.properties` files.

Keep templates for **showing** data. Calculations belong in controllers and models.

=== crash
- `${…}` and `<isprint>` HTML-encode by default. Never use `encoding="off"` with user input (XSS).
- `<isinclude template="x"/>` = **local include**, rendered in the same request. `<isinclude url="${URLUtils.url('Route')}"/>` = **remote include**, a separate request with its **own cache policy**.
- `<isdecorate>` + `<isreplace/>` = layout wrapping (SFRA uses `common/layout/page`).
- `<iscache type="relative" hour="24"/>` caches the page; with several `iscache` tags, the **shortest** setting wins. SFRA usually sets caching in the controller via the cache middleware instead.
- `<isslot id="…" context="global|category|folder" description="…"/>` = content slot filled by campaigns.
- `<iscontent type="application/json" charset="UTF-8"/>` sets the response type.
- `<isscript>` exists, but business logic in templates is a bad practice.
- Text: `Resource.msg(key, bundle, default)` and `Resource.msgf` for placeholders; files in `templates/resources/bundle_xx_YY.properties`.
- `<isset name="x" value="${…}" scope="page"/>` sets a variable.

=== standard
## Expressions and pdict
Everything passed with `res.render('tpl', data)` is available as `pdict.*`. Platform helpers are available too: `URLUtils`, `Resource`, `StringUtils`, `dw.system.Site`.

```isml
<isdecorate template="common/layout/page">
    <isinclude template="product/components/breadcrumbs"/>
    <h1><isprint value="${pdict.product.productName}"/></h1>
    <isif condition="${pdict.product.available}">
        <button class="add-to-cart">${Resource.msg('button.addtocart', 'common', null)}</button>
    <iselse/>
        <span>${Resource.msg('label.not.available', 'common', null)}</span>
    </isif>
    <isloop items="${pdict.product.images.large}" var="img" status="loop">
        <img src="${img.url}" alt="${img.alt}" loading="${loop.first ? 'eager' : 'lazy'}"/>
    </isloop>
</isdecorate>
```

## Encoding (security)
`${…}` and `<isprint>` encode HTML by default. `encoding="off"` prints raw HTML. Only use it for trusted, already-sanitised markup (for example Page Designer region output or CMS HTML from Business Manager), never for request parameters or customer input. For JavaScript or attribute contexts use `dw.util.SecureEncoder` (for example `forJavaScript`).

## Local vs remote include
| | Local `template=` | Remote `url=` |
|---|---|---|
| Request | Same request | New request to a controller |
| Data | Shares pdict | Only URL parameters |
| Caching | Part of the parent page | Its own cache policy |
| Cost | Cheap | Extra request; use when caching differs |

Typical use of remote includes: a fully cached product page that includes a small uncached piece (mini-cart, login state).

## Decorators
The page template calls `<isdecorate template="layout">`; the layout contains `<isreplace/>` where the page body goes. Several pages share one layout.

## Caching in templates
`<iscache type="relative" hour="1"/>` (or `type="daily" hour="0"`) marks the page for the web-server page cache. If several `iscache` tags apply (including local includes), the lowest setting wins. Page caching must be enabled for the site. SFRA prefers the controller middleware `cache.applyDefaultCache`, which sets the cache period on the response.

## Slots
`<isslot id="home-main" context="global" description="Home hero"/>` defines a place merchants fill with content in Business Manager or campaigns. Slot configurations decide what shows, when and for whom.

## Localisation
`templates/resources/common.properties`, `common_de.properties`, `common_en_GB.properties` hold text. `Resource.msg('key','common',null)` picks the best match for the request locale. Templates can also be localised by folder (`templates/de_DE/…`) but properties files are the common approach.

=== notes
- Never turn encoding off for anything a shopper or URL can influence.
- One slow uncached fragment can be split into a remote include so the rest of the page stays cached.
- Keep `<isscript>` out of templates: put logic in models or helpers.

=== q basic top
What is pdict?
---
The pipeline dictionary: the data object a controller passes to the template with `res.render`. Templates read it as `${pdict.something}`.

=== q basic top
How do you prevent XSS in ISML?
---
Rely on default encoding of `${}` and `<isprint>`, never use `encoding="off"` for untrusted values, and use `SecureEncoder` for JavaScript or other contexts.

=== q mid top
Local include vs remote include?
---
A local include (`template=`) renders another template in the same request and shares pdict. A remote include (`url=`) makes a separate request to a controller, gets only URL parameters, and can have its own cache settings: useful for mixing cached and uncached parts.

=== q mid top
How does iscache behave when several templates on one page set it?
---
The most restrictive setting wins: the shortest duration, or no caching if any of them turns it off. Remote includes are cached separately.

=== q mid
How do decorators work?
---
The page wraps its content in `<isdecorate template="layout">`; the layout template places that content where it has `<isreplace/>`.

=== q mid
How do you show translated text?
---
Put keys in `.properties` files under `templates/resources` (per locale) and use `Resource.msg('key','bundle',default)` or `Resource.msgf` for placeholders.

=== q adv
A cached product page must show the shopper's name. How?
---
Keep the page cached and move the personal part into a remote include pointing at an uncached controller (or load it with client-side AJAX). Never put personal data into a cached response.

=== p easy
Print a value safely
---
Print the search term the shopper typed.
---
`<isprint value="${pdict.searchPhrase}"/>`. Encoding is on by default, so script tags are shown as text, not run.

=== p std
Mixed caching
---
The home page should be cached for 24 hours, but the header mini-cart count must be live. Write the template idea.
---
Home controller uses `cache.applyDefaultCache` (or `<iscache type="relative" hour="24"/>`). In the header:
```isml
<isinclude url="${URLUtils.url('Cart-MiniCart')}"/>
```
`Cart-MiniCart` doesn't apply caching, so each page load fetches the live count while the rest comes from the page cache.
