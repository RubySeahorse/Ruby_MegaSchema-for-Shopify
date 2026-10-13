# Ruby MegaSchema for Shopify

Theme-owned structured data for Shopify stores. MegaSchema replaces scattered JSON-LD blocks with one connected
`@graph` per page, in which the company, website, page, breadcrumb and main item reference each other by
stable `@id`. It also includes a metafield-driven FAQ section and a validator that runs without installing
anything beyond VS Code.

## What it outputs

| Page | Nodes |
| --- | --- |
| Every page | Organization, WebSite with SearchAction, Brand, MerchantReturnPolicy, page node, BreadcrumbList |
| Product | ItemPage, Product or ProductGroup with one Product per variant, Offers with GTIN, strikethrough price, shipping details and return policy (including a final-sale policy by tag), product videos, related products, attributes from metafields, AggregateRating when review metafields exist |
| Collection | CollectionPage, ItemList of products |
| Blog / article | Blog with BlogPosting list / BlogPosting with author and publisher |
| About / Contact | AboutPage / ContactPage pointing at the Organization |
| Product and collection FAQs | FAQPage built from the same metafields as the visible accordion |

All business values (address, phone, brands, shipping times, return fees, final-sale tags) are theme settings
in a Structured data group, so the code is the same for every store. A Schema source setting switches between
MegaSchema, the theme's previous schema and off, for rollback without a code change.

## Repository layout

```
theme/
  snippets/mega-schema.liquid          entry point, outputs the @graph
  snippets/mega-schema-site.liquid     Organization, WebSite, Brand, return and shipping policies
  snippets/mega-schema-page.liquid     page node, BreadcrumbList, ItemList, Blog, BlogPosting
  snippets/mega-schema-product.liquid  Product / ProductGroup, variants, offers
  sections/metafield-faq.liquid        FAQ accordion + FAQPage from pdp_faq_* / plp_faq_* metafields
  config/settings_schema.json          the Structured data settings group to append to a theme
docs/
  Implementation-Guide.md              step-by-step install, every field, policy mapping, troubleshooting
  theme-liquid-switch.liquid           the render switch for layout/theme.liquid
validator/
  run.js                               renders the snippets with sample data and checks the JSON-LD
  vendor/liquid.node.js                LiquidJS 10.30.0 (MIT)
```

## Quick start

1. Copy `theme/snippets/*` and `theme/sections/*` into the theme.
2. Append the group in `theme/config/settings_schema.json` to the theme's `config/settings_schema.json`.
3. Replace the theme's existing structured-data render in `layout/theme.liquid` with
   `docs/theme-liquid-switch.liquid`, and remove other JSON-LD the theme outputs.
4. Create the FAQ metafields and fill in Theme settings > Structured data.
5. Validate locally, then on a preview theme, then launch.

The [Implementation Guide](docs/Implementation-Guide.md) covers each step, including what to adapt per store.

## Validate

```
cd validator
node run.js ../theme ./vendor/liquid.node.js ./out
```

No Node.js? VS Code's built-in runtime works the same way; see [validator/README.md](validator/README.md).

## Compatibility

Built and tested on Shopify's Prestige theme (11.x) using Online Store 2.0 JSON templates. The snippets use
standard Liquid objects only, so they work on other themes once the theme's own structured data is removed
(Step 4 of the guide).

## Credits

Built by Ruby Robinson. LiquidJS is copyright 2016-2026 harttle, released under the MIT
License.
