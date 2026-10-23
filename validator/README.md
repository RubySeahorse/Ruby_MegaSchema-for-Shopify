# MegaSchema validator

Renders the MegaSchema snippets with [LiquidJS](https://github.com/harttle/liquidjs) against sample Shopify
data, then checks that:

- every snippet renders without a Liquid error,
- every JSON-LD block is valid JSON,
- no node `@id` appears twice in a graph,
- every `@id` reference points to a node on the same page,
- no return policy node is left with nothing pointing to it, and nothing points to the Product, ProductGroup,
  BreadcrumbList or FAQPage, so the Schema Markup Validator lists each as its own section,
- a review-app style block (only an `@id` and a rating, as Bazaarvoice injects) merges into the product node,
- every GTIN is digits only, the right length and has a valid GS1 check digit (sample data includes invalid
  barcodes that must be omitted),
- breadcrumbs follow the collection hierarchy (`custom.parent_collection`, `custom.breadcrumb_parent_collection`
  and `custom.subcollections`), respect the depth setting, stop at loops and skip excluded collections,
- products from owned brands name the company as manufacturer, and a resold product (vendor not in
  `schema_brands`) gets no manufacturer and is not claimed in the company's brand list.

It first tokenizes every Liquid file the way Shopify does, flagging output tags that Shopify would reject. It
then covers 18 page scenarios: home, multi-variant product (with and without collection context), single-variant
final-sale product, a product resold from another vendor, a product in a 5-level collection hierarchy (and the
same capped at 3 levels), collection, a collection in a hierarchy, a hierarchy with a loop, blog, two articles,
About, Contact, another
page, search and 404. Rendered
JSON-LD is written to the output folder for review.

## Run with Node.js

    node run.js ../theme ./vendor/liquid.node.js ./out

## Run without installing Node.js

VS Code includes a Node runtime. From PowerShell:

    $env:ELECTRON_RUN_AS_NODE = 1
    & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" run.js ..\theme .\vendor\liquid.node.js .\out
    Remove-Item Env:ELECTRON_RUN_AS_NODE

From Git Bash:

    ELECTRON_RUN_AS_NODE=1 "$LOCALAPPDATA/Programs/Microsoft VS Code/Code.exe" run.js ../theme ./vendor/liquid.node.js ./out

Point the first argument at any Shopify theme folder that contains the MegaSchema files to test that theme.

## Options

- `MEGASCHEMA_DEFAULTS_ONLY=1` skips `TEST_SETTINGS` and renders with the settings defaults alone, which is
  what a fresh install outputs before anyone fills in Theme settings > Structured data.
- Edit `TEST_SETTINGS` and the sample store data near the top of `run.js` to match a real store: vendors,
  option names, final-sale tags, attribute metafields and article authors.

The exit code is 0 when every scenario passes and 1 otherwise, so the script can run in CI.

## Limits

LiquidJS follows Shopify's Liquid closely but is not Shopify's renderer, and Shopify objects and filters are
mocked. Passing here means the Liquid and JSON are sound. Still run Google's Rich Results Test and the Schema
Markup Validator (validator.schema.org) on a theme preview before launch.

## Third-party code

`vendor/liquid.node.js` is LiquidJS 10.30.0, copyright 2016-2026 harttle, released under the MIT License.
