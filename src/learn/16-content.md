id: content
title: Content, slots and Page Designer
icon: template
time: 7|4|18
summary: Content assets and libraries, content slots, and building Page Designer page and component types.
source: Trailhead: Page Designer controllers, JSON and scripts | https://trailhead.salesforce.com/content/learn/modules/salesforce-b2c-commerce-page-designer-for-sfra-developers/discover-page-and-component-type-controllers-json-and-scripts
source: Trailhead: Explore Page Designer JSON and JS | https://trailhead.salesforce.com/content/learn/modules/b2c-page-designer-developers/b2c-page-designer-explore-json-js

=== easy
Shops need more than products: banners, FAQ pages, size guides.

- **Content assets** are pieces of content (text, HTML, images) stored in a **library**.
- **Content slots** are fixed places in a template (like "home page hero") that merchants fill with content, products or categories, on a schedule and for chosen customers.
- **Page Designer** lets merchants build whole pages by dragging **components** (banner, carousel, text block) into **regions**. Developers create the types of pages and components; merchants assemble them.

For each Page Designer type a developer writes two files with the same name: a **JSON** file describing it (fields and regions) and a **JavaScript** file that renders it, usually with an ISML template.

=== crash
- Content assets live in **libraries** (site-private or shared); folders organise them; render with `ContentMgr.getContent(id)` and `asset.custom.body`.
- Slots: `<isslot id="…" context="global|category|folder" context-object="${…}" description="…"/>`; slot configurations set content type, template, schedule, customer groups, and can belong to campaigns.
- Page Designer types live in `cartridge/experience/pages` and `cartridge/experience/components` (subfolders allowed; component type ID becomes `folder.name`).
- Each type = **meta definition JSON** + **script .js** with the same name in the same folder; names only letters, digits, underscore.
- JSON: `name`, `description`, `attribute_definition_groups` (attributes: string, text, markup, image, file, boolean, enum, product, category, page, custom, url…), `region_definitions` (id, name, `max_components`, component type inclusions/exclusions). Components include `region_definitions: []` if none.
- Script exports `render(context)` returning a **string**; usually `new Template('experience/components/x').render(model).text`.
- Page context: `context.page`; component context: `context.content` (merchant values), `context.component`, `context.componentRenderSettings`.
- Render regions with `PageRenderHelper.renderRegion(page.getRegion('main'))` printed with `encoding="off"` (trusted markup).
- Show a page from a controller: `PageMgr.renderPage(pageId, params)`; SFRA has `Page-Show?cid=…`. Pages can be assigned to categories (`PageMgr.getPageByCategory`).
- Page Designer pages are content assets → they're in libraries and replicate with content.

=== standard
## Content assets and slots
```js
var ContentMgr = require('dw/content/ContentMgr');
var asset = ContentMgr.getContent('size-guide');
if (asset && asset.online) { body = asset.custom.body; }
```
Slots in templates:
```isml
<isslot id="home-hero" context="global" description="Home page hero banner"/>
<isslot id="cat-banner" context="category" context-object="${pdict.category}" description="Category banner"/>
```
Merchants create slot configurations in Business Manager (Online Marketing › Content Slots) and can schedule them inside campaigns.

## Page Designer files
```
cartridge/experience/pages/landing.json
cartridge/experience/pages/landing.js
cartridge/experience/components/assets/heroBanner.json
cartridge/experience/components/assets/heroBanner.js
cartridge/templates/default/experience/pages/landing.isml
cartridge/templates/default/experience/components/assets/heroBanner.isml
```
`heroBanner.json`:
```json
{
  "name": "Hero banner",
  "group": "assets",
  "attribute_definition_groups": [
    { "id": "main", "name": "Content", "attribute_definitions": [
      { "id": "image", "name": "Image", "type": "image", "required": true },
      { "id": "headline", "name": "Headline", "type": "string" },
      { "id": "link", "name": "Link", "type": "url" }
    ] }
  ],
  "region_definitions": []
}
```
`heroBanner.js`:
```js
var Template = require('dw/util/Template');
var HashMap = require('dw/util/HashMap');
module.exports.render = function (context) {
    var model = new HashMap();
    model.image = context.content.image;          // dw.experience.image.Image
    model.headline = context.content.headline;
    model.link = context.content.link;
    return new Template('experience/components/assets/heroBanner').render(model).text;
};
```
Page script and template:
```js
module.exports.render = function (context) {
    var model = new HashMap();
    model.page = context.page;
    model.regions = new (require('*/cartridge/experience/utilities/RegionModelRegistry'))(context.page, require('*/cartridge/experience/pages/landing.json'));
    return new Template('experience/pages/landing').render(model).text;
};
```
```isml
<isdecorate template="common/layout/page">
  <isprint value="${pdict.regions.main.render()}" encoding="off"/>
</isdecorate>
```
(Simpler: `PageRenderHelper.renderRegion(pdict.page.getRegion('main'))`.)

## Rules
- File names: letters, digits, underscores; JSON and JS must match and sit together.
- Region definitions limit components (`max_components`) and allowed types (inclusions/exclusions).
- Visibility and scheduling are set by merchants per component.
- Pages are content: they live in a library and replicate with content.

=== notes
- Markup from regions is trusted platform output, which is why it's printed with encoding off; never do that for request data.
- Keep component scripts light; they run for every render (cache the page).
- Component type ID includes the subfolder path with dots.

=== q basic top
What's the difference between a content asset, a content slot and a Page Designer page?
---
A content asset is a stored piece of content in a library. A slot is a fixed location in a template that merchants fill with content, products or categories by configuration. A Page Designer page is a merchant-assembled page built from components placed in regions.

=== q basic top
Which files make up a Page Designer component type?
---
A JSON meta definition (attributes and regions) and a JavaScript file with a render function, same name, same folder under `experience/components`, usually plus an ISML template.

=== q mid top
What does the render function return and receive?
---
It returns the markup as a string. It receives a context: for pages `context.page`, for components `context.content` (merchant-set values), `context.component` and render settings.

=== q mid
How do you limit what can be placed in a region?
---
In the region definition: `max_components`, and `component_type_inclusions` or `component_type_exclusions`.

=== q mid
How is a Page Designer page shown on the storefront?
---
Through a controller calling `PageMgr.renderPage(pageId, …)` (SFRA: `Page-Show?cid=pageId`), or assigned to a category and rendered via `PageMgr.getPageByCategory`.

=== q adv
Why is region output printed with encoding off and is that safe?
---
The region render returns HTML built by component templates, so it must not be escaped again. It's safe as long as the component templates themselves encode merchant values properly; never extend that pattern to request data.

=== p easy
Where does it go?
---
Marketing wants a banner on the home page that changes every two weeks. Slot or new code?
---
A **content slot** already in the home template (or a Page Designer component). Merchants schedule slot configurations in campaigns; no new code per change.

=== p std
Create a "USP bar" component
---
Three short texts with icons, editable by merchants.
---
`experience/components/assets/uspBar.json` with attributes `text1..3` (string) and `icon1..3` (enum of icon names), `region_definitions: []`; `uspBar.js` builds a HashMap with the values and renders `experience/components/assets/uspBar.isml`, which prints the texts with default encoding.
