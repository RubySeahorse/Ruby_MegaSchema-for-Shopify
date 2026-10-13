# Ruby MegaSchema Implementation Guide

How to install and configure MegaSchema structured data on any Shopify store.

## What you will have at the end

Every page of the store outputs one connected JSON-LD graph that describes the company, the website, the page,
its breadcrumb trail and the page's main item, with each node linked to the others by a stable `@id`. Product
pages describe every variant with its price, availability, barcode, shipping and return policy. Product and
collection FAQs are edited as metafields in the Shopify admin and appear on the page as an accordion together
with matching FAQPage markup. All business details (address, phone, policies, brands) are theme settings, so
the same code serves any store.

The build has seven theme files and one validator:

| File | Role | Store-specific edits |
| --- | --- | --- |
| `snippets/mega-schema.liquid` | Entry point. Collects the nodes into one `@graph`. | None |
| `snippets/mega-schema-site.liquid` | Organization, WebSite, Brand, return policy and shipping nodes | None (values come from settings) |
| `snippets/mega-schema-page.liquid` | Page node, BreadcrumbList, collection ItemList, Blog, BlogPosting | About and Contact page handles, if they differ |
| `snippets/mega-schema-product.liquid` | Product or ProductGroup, variants, offers | Option names and attribute metafields (Step 5) |
| `sections/metafield-faq.liquid` | Visible FAQ accordion and FAQPage markup | Metafield prefixes, if they differ |
| `config/settings_schema.json` (added group) | Structured data settings | Default values for the store |
| `layout/theme.liquid` (one edit) | Renders the entry point | Location of the theme's existing schema render |
| `validator/` (outside the theme) | Renders the snippets with sample data and checks the JSON-LD | Sample data (Step 8) |

## Before you start

- Shopify admin access with permission to edit themes and metafield definitions.
- The theme in a GitHub repository, connected through Shopify's GitHub integration (Online Store > Themes >
  Add theme > Connect from GitHub).
- VS Code with Git. Node.js is optional; the validator also runs on the Node runtime built into VS Code.
- Matrixify or the Shopify bulk editor, for loading FAQ content.
- The store's official return policy text, shipping times, company address, phone and email.

## Step 1: Gather the store facts

The schema is only as accurate as these answers. Record them before writing any code.

| Question | Where to find it | Used for |
| --- | --- | --- |
| Which vendors does the store use? | Public feed `/products.json?limit=250&page=1` (then 2, 3...), `vendor` field; or a Matrixify product export | Brand entities and Product brand |
| Which tag marks final-sale, closeout or discontinued products? | Product tags in the feed or export; confirm with customer service | Final-sale return policy |
| What are the variant option names? | `options` in the feed | Color and size mapping, `variesBy` |
| Do variants have barcodes, weights and compare-at prices? | Feed (`compare_at_price`, `grams`) and export (barcode) | GTIN, strikethrough price |
| Which product metafields describe fit or attributes? | Settings > Custom data > Products, or the Metafield columns of a Matrixify export | `additionalProperty` |
| Are complementary or related products set in Search & Discovery? | Search & Discovery app > Product recommendations | `isRelatedTo`, `isSimilarTo` |
| What does the return policy say? | Official policy text | Return policy nodes (Step 6) |
| How long are handling and transit times, and what does shipping cost? | Operations | Shipping node |
| Where does the theme already output JSON-LD? | Search the theme for `ld+json` and `structured_data` (Step 4) | Removing duplicates |
| Which apps inject structured data? | Theme editor > App embeds; view-source of a product page | Removing duplicates at launch |

## Step 2: Set up a safe working branch

1. In Shopify, duplicate the published theme so you have an unpublished copy.
2. Connect the repository's main branch to the published theme only if you intend every merge to go live
   immediately. Otherwise keep main connected to an unpublished theme.
3. In VS Code, pull main (Source Control > Pull), then create a branch for the work, for example
   `feature/mega-schema`.
4. Push the branch and connect it to its own unpublished theme (Add theme > Connect from GitHub > choose the
   branch). That theme is your preview for every test in this guide.
5. Theme editor changes on a connected theme are committed back to its branch by Shopify. Pull before every
   local editing session.

## Step 3: Create the FAQ metafields

Create these definitions in Settings > Custom data. All are single line text. Answers must be one line with no
line breaks, or imports fail.

| Owner | Namespace and key | Purpose |
| --- | --- | --- |
| Product | `custom.pdp_faq_title` | Heading shown above the FAQ |
| Product | `custom.pdp_faq_question_1` to `custom.pdp_faq_question_12` | Questions, in display order |
| Product | `custom.pdp_faq_answer_1` to `custom.pdp_faq_answer_12` | Answers, matching each question number |
| Collection | `custom.plp_faq_title` | Heading shown above the FAQ |
| Collection | `custom.plp_faq_question_1` to `custom.plp_faq_question_12` | Questions |
| Collection | `custom.plp_faq_answer_1` to `custom.plp_faq_answer_12` | Answers |

To bulk load with Matrixify, use column headers in the form
`Metafield: custom.pdp_faq_question_1 [single_line_text_field]`. A question only appears when its answer is
also filled, so partial rows never produce half an FAQ.

## Step 4: Add the files and remove existing schema

1. Copy the four `theme/snippets/mega-schema*.liquid` files into the theme's `snippets/` folder and
   `theme/sections/metafield-faq.liquid` into `sections/`.
2. Append the Structured data group from `theme/config/settings_schema.json` to the end of the theme's
   `config/settings_schema.json`, as the last item of the top-level array.
3. Search the theme for existing structured data: `ld+json`, `structured_data` and `itemscope`. Prestige
   renders it from `snippets/microdata-schema.liquid` near the end of `layout/theme.liquid`. Dawn-based themes
   output Product JSON-LD inside `sections/main-product.liquid` and Article JSON-LD inside
   `sections/main-article.liquid`.
4. In `layout/theme.liquid`, replace the existing schema render with the switch in
   `docs/theme-liquid-switch.liquid`, placed just before the closing `</body>` tag. Remove any other JSON-LD
   found in item 3 except FAQ sections.

```liquid
{%- case settings.schema_source -%}
  {%- when 'legacy' -%}
    {%- render 'microdata-schema' -%}
  {%- when 'off' -%}
  {%- else -%}
    {%- render 'mega-schema' -%}
{%- endcase -%}
```

On a theme without a `microdata-schema` snippet, point the legacy option at whatever the theme rendered
before, or remove that option.

## Step 5: Adapt the store-specific code

| File | What to check | Shipped value |
| --- | --- | --- |
| `mega-schema-product.liquid` | Option names mapped to color and size | color, colour, cover color; size |
| `mega-schema-product.liquid` | Metafield used for Product line (output when it differs from the vendor) | `custom.product_brand` |
| `mega-schema-product.liquid` | Attribute metafields and their labels in `additionalProperty` | `custom.grill_type` (Grill type), `custom.rv_type` (RV type), `custom.patio_furniture_fit` (Furniture fit) |
| `mega-schema-page.liquid` | About page detection | Any page handle containing "about" |
| `mega-schema-page.liquid` | Contact page detection | Handle `contact` or template suffix `contact` |
| `metafield-faq.liquid` | Metafield prefixes | `pdp_faq_` (products), `plp_faq_` (collections) |

A metafield that does not exist on a store is skipped automatically, so unused attribute lines can stay in
place.

## Step 6: Fill in the Structured data settings

Theme editor > Theme settings > Structured data. Set the defaults in `settings_schema.json` to the store's
values so a fresh install is correct before anyone opens the editor.

| Setting | Setting ID | How to fill it | Example |
| --- | --- | --- | --- |
| Schema source | `schema_source` | MegaSchema, Legacy (rollback) or Off | MegaSchema |
| Legal name | `schema_legal_name` | Registered company name; blank to omit | Example Outdoor Co., Inc. |
| Company description | `schema_org_description` | Two to four factual sentences about the company. No promotions. | The About page summary |
| Founding date | `schema_founding_date` | Year or ISO date | 1990 |
| Customer service phone | `schema_phone` | International format | +1-555-010-0000 |
| Customer service email | `schema_email` | Public support address | support@example-store.com |
| Street, City, State, Postal code | `schema_street`, `schema_city`, `schema_region`, `schema_postal_code` | Headquarters address exactly as on the Contact page | 100 Example Way, Suite 1 / Seattle / WA / 98101 |
| Country code | `schema_country` | Two letters; also used for policy countries | US |
| Extra profile URLs | `schema_same_as` | One URL per line for profiles not in Settings > Brand (Amazon, Wikipedia) | Blank |
| Brands | `schema_brands` | Comma-separated brand names; product vendors are added automatically on their pages | Example Outdoor Co., Trailhead |
| Shipping rate | `schema_shipping_rate` | Standard shipping cost; 0 for free | 0 |
| Handling and transit days | `schema_handling_min`, `schema_handling_max`, `schema_transit_min`, `schema_transit_max` | Business days from order to shipment, and in transit | 1 to 3, 3 to 5 |
| Return window | `schema_return_days` | Days allowed for returns | 30 |
| Return shipping fee | `schema_return_fee` | Fee for change-of-mind returns; 0 for free returns | 25 |
| Restocking fee | `schema_restocking_fee` | Percentage; 0 to omit | 10 |
| Final-sale product tags | `schema_final_sale_tags` | Comma-separated tags for non-returnable products | final-sale |
| Return policy URL | `schema_return_policy_url` | Path or full URL of the policy page | /policies/refund-policy |
| Strikethrough prices | `schema_show_strikethrough` | On only when compare-at prices are genuine former prices | On |
| Breadcrumb exclusions | `schema_breadcrumb_exclude` | Collection handles never used as a product's breadcrumb parent | frontpage, sale, best-sellers |

Social profiles come from Settings > Brand in the Shopify admin and from the theme's Social media settings.
The logo comes from Settings > Brand.

## Step 7: Place the FAQ section

1. In the theme editor, open each product template, add the Metafield FAQ section, and position it.
2. Repeat for every collection template, including alternate templates.
3. Remove any older FAQ blocks so each page has one FAQ.
4. Check that the section's "Output FAQ structured data" setting is on, unless another source already outputs
   FAQPage on that page.

The section hides itself on pages with no complete question and answer, so it is safe on every template.

## Step 8: Validate locally

The validator renders the snippets with sample data and checks the output before anything reaches Shopify.

1. Open the sample data near the top of `validator/run.js` and match it to the store: vendors, option names, a
   final-sale tag, attribute metafields, an article author.
2. Run it against the theme folder (see `validator/README.md` for running without Node.js):

   ```
   node run.js "<path to theme>" ./vendor/liquid.node.js ./out
   ```

3. Every scenario should print PASS. A FAIL names the problem: a Liquid render error with file and line,
   invalid JSON, a duplicate node or a reference to an `@id` that is not on the page.
4. Open the files in `out/` to read the rendered JSON-LD for each page type.
5. Run once more with `MEGASCHEMA_DEFAULTS_ONLY=1` to confirm a fresh install with blank settings still
   outputs valid JSON-LD.

## Step 9: Test on the preview theme

1. Push the branch. Shopify updates the connected unpublished theme.
2. Use the theme's Share preview link to open one page of each type: home, single-variant product,
   multi-variant product, final-sale product, collection with FAQ, collection without FAQ, blog, article,
   About, Contact, another page, search.
3. Run each preview URL through Google's Rich Results Test and the Schema Markup Validator
   (validator.schema.org).
4. View the page source and confirm one MegaSchema script, plus at most one FAQPage script, and no other
   JSON-LD for the same entities.

The Rich Results Test does not list FAQ markup for most stores, because Google limits FAQ rich results to
government and health sites. Use the Schema Markup Validator to confirm the FAQPage.

## Step 10: Launch and monitor

1. Merge the branch into the branch connected to the live theme, or publish the tested preview theme.
2. In the same change, turn off any app embed that outputs structured data.
3. Rollback: set Schema source to Legacy in Theme settings.
4. Over the next two to four weeks, watch Search Console: Merchant listings, Product snippets, Breadcrumbs,
   and the Page indexing report for new errors.

## Reference: identifier conventions

`{site}` is the store URL (`shop.url`). `{page}` is the canonical URL without query parameters.

| Node | `@id` |
| --- | --- |
| Organization | `{site}/#organization` |
| WebSite | `{site}/#website` |
| Return policy / final-sale return policy | `{site}/#return_policy` / `{site}/#return_policy_final_sale` |
| Shipping details | `{site}/#shipping_policy` |
| Brand | `{site}/#brand-{brand handle}` |
| Page node / BreadcrumbList | `{page}#webpage` / `{page}#breadcrumb` |
| Product / ProductGroup | `{site}{product URL}#product` / `#productgroup` |
| Variant | `{site}{variant URL}#variant` |
| Collection list / Blog / Article / FAQ | `{page}#itemlist` / `#blog` / `#article` / `#faq` |

## Reference: nodes and fields

### Organization (every page)

| Property | Source |
| --- | --- |
| name, url | `shop.name`, `shop.url` |
| legalName | `schema_legal_name`, when filled |
| logo (ImageObject with url, width, height), image | Settings > Brand logo |
| description | `schema_org_description`, falling back to the Brand short description |
| foundingDate | `schema_founding_date` |
| address (PostalAddress) | `schema_street`, `schema_city`, `schema_region`, `schema_postal_code`, `schema_country` |
| contactPoint (ContactPoint) | contactType "customer service", telephone, email, areaServed, availableLanguage |
| sameAs | Brand social links, theme social settings and `schema_same_as`, without duplicates |
| brand | References to each Brand node |
| hasMerchantReturnPolicy | Reference to the return policy node |

### WebSite (every page)

name, url, description (shop description), inLanguage (current locale), publisher (Organization),
potentialAction: SearchAction whose target is an EntryPoint with urlTemplate
`{site}/search?q={search_term_string}` and query-input `required name=search_term_string`.

### Brand (every page)

One node per name in `schema_brands` plus the vendor of the current product: `@id`, name, and url when a
collection exists with the brand's handle.

### MerchantReturnPolicy (every page) and final-sale policy (product pages)

| Property | Value |
| --- | --- |
| applicableCountry, returnPolicyCountry | `schema_country` |
| returnPolicyCategory | MerchantReturnFiniteReturnWindow (final-sale: MerchantReturnNotPermitted) |
| merchantReturnDays | `schema_return_days` |
| returnMethod | ReturnByMail |
| refundType | FullRefund |
| itemCondition | NewCondition |
| customerRemorseReturnFees | ReturnShippingFees when `schema_return_fee` is above 0, otherwise FreeReturn |
| customerRemorseReturnShippingFeesAmount | MonetaryAmount: `schema_return_fee` in the store currency |
| restockingFee | `schema_restocking_fee` (percent), when above 0 |
| itemDefectReturnFees | FreeReturn |
| merchantReturnLink | `schema_return_policy_url` |

### OfferShippingDetails (product pages)

shippingRate (MonetaryAmount: `schema_shipping_rate`), shippingDestination (DefinedRegion: `schema_country`),
deliveryTime (ShippingDeliveryTime) with handlingTime and transitTime as QuantitativeValue minValue and
maxValue in unitCode DAY.

### Page node (every page)

| Page | `@type` | mainEntity or about |
| --- | --- | --- |
| Home | WebPage | about: Organization |
| Product | ItemPage | mainEntity: Product or ProductGroup |
| Collection | CollectionPage | mainEntity: ItemList |
| Blog | WebPage | mainEntity: Blog |
| Article | WebPage | mainEntity: BlogPosting |
| About page | AboutPage | mainEntity: Organization |
| Contact page | ContactPage | mainEntity: Organization |
| Search | SearchResultsPage | None |
| Any other page | WebPage | None |

Every page node also has url, name (page title), description (meta description), primaryImageOfPage when the
page has an image, breadcrumb, inLanguage and isPartOf (WebSite).

### BreadcrumbList (every page except home, 404, cart and password)

Starts with Home. Product: Home, collection, product, where the collection is the one in the URL or else the
product's first collection not listed in `schema_breadcrumb_exclude`. Collection: Home, collection. Blog:
Home, blog. Article: Home, blog, article. Other pages: Home, page.

### ItemList (collection pages)

name, description (collection description as plain text, up to 300 characters), numberOfItems (collection
product count), itemListElement: up to 24 ListItem entries with position, url and name.

### Blog and BlogPosting

Blog page: Blog with name, url, publisher and blogPost (up to 20 BlogPosting entries with `@id`, headline, url,
image, datePublished, dateModified, author). Article page: BlogPosting with headline, url, description
(excerpt, or the first 300 characters of the content), image, datePublished, dateModified, author (the
Organization when the author is the store name, otherwise a Person), publisher, mainEntityOfPage, isPartOf
(Blog with name and url) and inLanguage.

### Product or ProductGroup (product pages)

| Property | Source |
| --- | --- |
| `@type` | ProductGroup when the product has more than one variant, otherwise Product |
| name, url | `product.title`, product URL |
| description | Product description as plain text (HTML removed, entities decoded, up to 5,000 characters), falling back to the SEO description. Repeated on every variant, because Google checks each variant as its own Product. |
| image | Up to 10 product images at 1,200 px |
| brand | Reference to the Brand node for `product.vendor` |
| manufacturer | Reference to the Organization |
| category | Shopify Standard Product Taxonomy category, falling back to product type |
| additionalProperty | PropertyValue entries from product-line and attribute metafields, plus Product type |
| isRelatedTo / isSimilarTo | Up to 4 Search & Discovery complementary / related products |
| subjectOf | VideoObject for each product video (name, description, thumbnailUrl, uploadDate, contentUrl for Shopify-hosted video, embedUrl for YouTube or Vimeo) |
| aggregateRating | `reviews.rating` and `reviews.rating_count` metafields, when filled |
| productGroupID, variesBy, hasVariant | ProductGroup only: product ID, schema.org/color and schema.org/size as mapped, one Product per variant |

### Variant Product and Offer

| Property | Source |
| --- | --- |
| name, description | Product title, a dash and the variant title; the product description |
| sku, mpn | `variant.sku` |
| gtin8, gtin12, gtin13 or gtin14 | `variant.barcode`, chosen by digit count; other lengths are skipped |
| color, size | Mapped option values |
| image | Variant image, falling back to the product image |
| inProductGroupWithID | Product ID |
| offers.url, price, priceCurrency | Variant URL, price as a plain number, store currency |
| offers.priceSpecification | StrikethroughPrice with the compare-at price, when it is above the price and `schema_show_strikethrough` is on |
| offers.availability, itemCondition | InStock or OutOfStock; NewCondition |
| offers.seller, shippingDetails, hasMerchantReturnPolicy | References to the Organization, shipping node and the return or final-sale policy |

### FAQPage (metafield-faq section)

`@id` `{page}#faq`, name (FAQ title metafield), isPartOf (page node), about (the product or the page),
mainEntity: one Question per complete pair, each with name and an acceptedAnswer Answer with text. The same
pairs render as the visible accordion.

## Translating a return policy into schema

| Policy says | Property and value |
| --- | --- |
| Returns within N days | returnPolicyCategory MerchantReturnFiniteReturnWindow, merchantReturnDays N |
| No returns | returnPolicyCategory MerchantReturnNotPermitted |
| Returns any time | returnPolicyCategory MerchantReturnUnlimitedWindow |
| Customer pays a fixed return shipping fee | customerRemorseReturnFees ReturnShippingFees with customerRemorseReturnShippingFeesAmount |
| Free returns | customerRemorseReturnFees FreeReturn |
| Restocking fee as a percentage | restockingFee as a number |
| Defective or wrong items returned free | itemDefectReturnFees FreeReturn |
| Money back / store credit / exchange only | refundType FullRefund / StoreCreditRefund / ExchangeRefund |
| Items must be unused or in original packaging | itemCondition NewCondition |
| Return by mail / in store | returnMethod ReturnByMail / ReturnInStore |
| Some products excluded | A second policy with MerchantReturnNotPermitted, attached to those products by tag |
| Conditions schema cannot express (shipping charges kept, assembled items) | merchantReturnLink to the full policy |

## Practices that keep the schema reliable

- One source per entity. Every page should have exactly one Organization, WebSite, page node, BreadcrumbList
  and product entity. Remove theme and app output that duplicates them.
- Stable, absolute `@id`s. Keep the patterns in this guide so search engines see the same entities across
  pages and over time.
- Markup matches the page. FAQ markup comes from the same data as the visible accordion, and product names
  match the on-page title rather than the SEO title.
- Never put a `}` inside a quoted string in an output tag (`{{ ... }}`). Shopify ends the tag at that brace and
  refuses to save the file. Build such strings with `assign` first, then output the variable.
- Every text value goes through the `json` filter, so quotes, ampersands and line breaks cannot break the
  JSON.
- Business facts live in theme settings, never in code.
- Policies state exactly what the official policy says. Confirm shipping times and fees with operations.
- Strikethrough prices only for genuine former prices.
- Prices are plain numbers with no currency symbol or thousands separator.
- Barcodes are labeled by length, and invalid lengths are omitted rather than guessed.
- Test single-variant, multi-variant and final-sale products every time the product snippet changes.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Validator: invalid JSON, unexpected comma | A conditional property left a trailing or doubled comma | Open the `.bad.txt` file in `out/`, find the comma, and adjust the condition that writes it |
| Validator: unresolved reference | A node points to an `@id` that is not on that page | Output the node on that page or describe it inline with its properties |
| Shopify reports "Could not find asset snippets/..." for a file that is in the repository | Shopify refused to sync the file because of a Liquid syntax error, often a `}` inside a string in `{{ ... }}` | Run the validator; its shopify-tokenizer check names the file and line |
| Validator: undefined filter | A Shopify-only filter is not mocked in `run.js` | Add a `registerFilter` line for it in `run.js`; it is not a theme error |
| Two Product or BreadcrumbList entries on the live page | Theme or app schema still active | Search the theme for `ld+json` and `structured_data`; turn off app embeds |
| Merchant listings warning on return policy | Settings do not match the policy page | Compare each setting with the official policy text |
| FAQ section missing on a page | No complete question and answer pair | Fill both fields of at least one pair |
| Matrixify import fails on answers | Line breaks in a single line text value | Remove line breaks from the cell |
