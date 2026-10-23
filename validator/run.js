// MegaSchema validator: renders the theme's schema snippets with LiquidJS against sample Shopify
// objects, then parses every JSON-LD block and checks @id references.
//
// Usage: node run.js <themeDir> <liquidjsPath> <outDir>
// Without Node.js installed, VS Code's built-in runtime works the same way (see README.md).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const [themeDir, liquidPath, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const { Liquid, Tag } = require(liquidPath);
fs.mkdirSync(outDir, { recursive: true });

const engine = new Liquid({
  root: ['snippets', 'sections', 'layout'].map((d) => path.join(themeDir, d)),
  extname: '.liquid',
  strictFilters: true,
  jsTruthy: false,
});

// Shopify-only tags that do not affect the output: skip their contents.
function ignoreBlock(name) {
  engine.registerTag(name, class extends Tag {
    constructor(token, remainTokens, liquid) {
      super(token, remainTokens, liquid);
      while (remainTokens.length) {
        if (remainTokens.shift().name === 'end' + name) return;
      }
      throw new Error(`${name} not closed`);
    }
    *render() {}
  });
}
['doc', 'schema', 'stylesheet', 'javascript', 'style'].forEach(ignoreBlock);

// Shopify-only filters, mocked closely enough for structured data.
engine.registerFilter('image_url', (img) => `//www.example-store.com/cdn/shop/${img && typeof img === 'object' ? img.src : img}?width=1200`);
engine.registerFilter('money_without_currency', (cents) => (Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
engine.registerFilter('handleize', (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('md5', (v) => crypto.createHash('md5').update(String(v)).digest('hex'));
engine.registerFilter('metafield_tag', (v) => String(v));

// Theme setting defaults from config/settings_schema.json (tolerates trailing commas), then test overrides
// so that every branch of the snippets is exercised.
const schemaText = fs.readFileSync(path.join(themeDir, 'config/settings_schema.json'), 'utf8').replace(/,(\s*[\]}])/g, '$1');
const settings = {};
for (const group of JSON.parse(schemaText)) {
  for (const s of group.settings || []) if (s.id && 'default' in s) settings[s.id] = s.default;
}
const TEST_SETTINGS = {
  schema_org_description: 'Example Outdoor Co. makes covers and cushions for outdoor living.',
  schema_founding_date: '1990',
  schema_phone: '+1-555-010-0000',
  schema_email: 'support@example-store.com',
  schema_street: '100 Example Way, Suite 1',
  schema_city: 'Seattle',
  schema_region: 'WA',
  schema_postal_code: '98101',
  schema_brands: 'Example Outdoor Co., Trailhead',
  schema_return_fee: 25,
  schema_restocking_fee: 10,
  schema_final_sale_tags: 'final-sale',
  schema_breadcrumb_exclude: 'frontpage, sale, clearance',
};
if (process.env.MEGASCHEMA_DEFAULTS_ONLY !== '1') Object.assign(settings, TEST_SETTINGS);

// Sample store data. Edit to match the store being tested.
const site = 'https://www.example-store.com';
const shop = {
  url: site,
  name: 'Example Outdoor Co.',
  description: 'Covers and cushions for outdoor living.',
  brand: {
    logo: { src: 'files/logo.png', width: 1200, height: 400 },
    short_description: '',
    metafields: { social_links: { facebook: { value: 'https://www.facebook.com/example' }, instagram: { value: 'https://www.instagram.com/example' } } },
  },
};
// Collection hierarchy: Outdoor Covers lists Seating Covers in custom.subcollections; Chair Covers names
// Seating Covers in custom.parent_collection; Chair Cushions names it in custom.breadcrumb_parent_collection.
// Clearance has a parent but is in the skip list, so it must never start a trail. Loop A and Loop B point at
// each other to test loop handling.
const makeCollection = (handle, title) => ({ handle, title, url: `/collections/${handle}`, metafields: { custom: {} } });
const trailhead = makeCollection('trailhead', 'Trailhead');
const outdoorCovers = makeCollection('outdoor-covers', 'Outdoor Covers');
const seatingCovers = makeCollection('seating-covers', 'Seating Covers');
const chairCovers = makeCollection('chair-covers', 'Chair Covers');
const chairCushions = makeCollection('chair-cushions', 'Chair Cushions');
const clearance = makeCollection('clearance', 'Clearance');
const loopA = makeCollection('loop-a', 'Loop A');
const loopB = makeCollection('loop-b', 'Loop B');
outdoorCovers.metafields.custom.subcollections = { value: [seatingCovers] };
chairCovers.metafields.custom.parent_collection = { value: seatingCovers };
chairCushions.metafields.custom.breadcrumb_parent_collection = { value: seatingCovers };
clearance.metafields.custom.breadcrumb_parent_collection = { value: seatingCovers };
loopA.metafields.custom.parent_collection = { value: loopB };
loopB.metafields.custom.parent_collection = { value: loopA };
const collectionList = [trailhead, outdoorCovers, seatingCovers, chairCovers, chairCushions, clearance, loopA, loopB];
// Shopify's collections object is both iterable and addressable by handle.
const collections = Object.assign(collectionList, Object.fromEntries(collectionList.map((c) => [c.handle, c])));

const productGroup = {
  id: 1001, title: 'Weatherproof "Pro" Grill Cover', handle: 'grill-cover', url: '/products/grill-cover',
  vendor: 'Example Outdoor Co.', type: 'Grill Cover', tags: ['grill', 'sale'], has_only_default_variant: false,
  description: '<p>Protects your grill &amp; smoker.</p>\n<ul><li>Vented sides</li><li>Click-close straps</li></ul>', published_at: '2026-03-01T10:00:00-07:00', category: { name: 'Grill Covers' },
  featured_image: { src: 'files/grill.jpg' }, images: [{ src: 'files/grill.jpg' }, { src: 'files/grill-2.jpg' }],
  options_with_values: [{ name: 'Color' }, { name: 'Size' }],
  variants: [
    { id: 11, title: 'Tan / 38" W', url: '/products/grill-cover?variant=11', sku: 'GC-38-TAN', barcode: '012345678905', price: 6095, compare_at_price: 6772, available: true, options: ['Tan', '38" W'], featured_image: { src: 'files/tan.jpg' } },
    { id: 12, title: 'Gray / 58" W', url: '/products/grill-cover?variant=12', sku: 'GC-58-GRY', barcode: '01234567890', price: 129999, compare_at_price: 129999, available: false, options: ['Gray', '58" W'], featured_image: null },
    { id: 13, title: 'Black / 38" W', url: '/products/grill-cover?variant=13', sku: 'GC-38-BLK', barcode: 'ABCDEFGHIJKL', price: 6095, compare_at_price: null, available: true, options: ['Black', '38" W'], featured_image: null },
    { id: 14, title: 'Black / 58" W', url: '/products/grill-cover?variant=14', sku: 'GC-58-BLK', barcode: '012345678906', price: 8095, compare_at_price: null, available: true, options: ['Black', '58" W'], featured_image: null },
  ],
  collections: [{ handle: 'frontpage', title: 'Home page', url: '/collections/frontpage' }, { handle: 'sale', title: 'Sale', url: '/collections/sale' }, { handle: 'grill-covers', title: 'Grill Covers', url: '/collections/grill-covers' }],
  media: [{ media_type: 'video', alt: 'How to fit the cover', sources: [{ format: 'm3u8', url: 'https://x/v.m3u8' }, { format: 'mp4', url: 'https://cdn.example/v.mp4' }], preview_image: { src: 'files/video.jpg' } }],
  metafields: {
    global: { description_tag: { value: 'A weatherproof grill cover with vents and straps.' } },
    custom: { product_brand: { value: 'Summit Line' }, grill_type: { value: 'Kamado' }, pdp_faq_title: { value: 'FAQs' }, pdp_faq_question_1: { value: 'Is it "waterproof"?' }, pdp_faq_answer_1: { value: 'Yes, with taped seams.' }, pdp_faq_question_2: { value: 'A question with no answer' } },
    'shopify--discovery--product_recommendation': { complementary_products: { value: [{ title: 'Grill Brush', url: '/products/grill-brush' }] }, related_products: { value: [] } },
    reviews: {},
  },
};
const productSingle = {
  id: 1002, title: 'Trailhead Loveseat Cover', handle: 'loveseat-cover', url: '/products/loveseat-cover',
  vendor: 'Trailhead', type: 'Furniture Cover', tags: ['final-sale'], has_only_default_variant: true,
  description: '<p>Tough & waterproof.</p>', published_at: '2025-05-01T10:00:00-07:00', category: null,
  featured_image: { src: 'files/loveseat.jpg' }, images: [{ src: 'files/loveseat.jpg' }], options_with_values: [{ name: 'Title' }],
  variants: [{ id: 21, title: 'Default Title', url: '/products/loveseat-cover?variant=21', sku: 'TH-LOVE', barcode: '0012345678905', price: 8999, compare_at_price: null, available: true, options: ['Default Title'], featured_image: null }],
  collections: [], media: [{ media_type: 'external_video', host: 'youtube', external_id: 'abc123', alt: '', preview_image: { src: 'files/yt.jpg' } }],
  metafields: { global: {}, custom: {}, reviews: { rating: { value: { rating: '4.6', scale_max: '5' } }, rating_count: { value: 23 } } },
};
const productHierarchy = {
  ...productSingle, id: 1004, title: 'Chair Cover Deluxe', handle: 'chair-cover', url: '/products/chair-cover',
  vendor: 'Example Outdoor Co.', tags: [], metafields: { global: {}, custom: {}, reviews: {} },
  collections: [clearance, { handle: 'sale', title: 'Sale', url: '/collections/sale' }, outdoorCovers, chairCovers],
  variants: [{ id: 41, title: 'Default Title', url: '/products/chair-cover?variant=41', sku: 'CC-DLX', barcode: '96385074', price: 4999, compare_at_price: null, available: true, options: ['Default Title'], featured_image: null }],
};
const productResold = {
  ...productSingle, id: 1003, title: 'Other Maker Patio Umbrella', handle: 'patio-umbrella', url: '/products/patio-umbrella',
  vendor: 'Other Maker Co.', tags: [], metafields: { global: {}, custom: {}, reviews: {} },
  variants: [{ id: 31, title: 'Default Title', url: '/products/patio-umbrella?variant=31', sku: 'OM-UMB', barcode: '96385074', price: 12999, compare_at_price: null, available: true, options: ['Default Title'], featured_image: null }],
};
const collection = {
  title: 'Grill Covers', handle: 'grill-covers', url: '/collections/grill-covers', products_count: 42,
  description: '<p>Covers for every grill & smoker.</p>', image: { src: 'files/collection.jpg' },
  products: [productGroup, productSingle],
  metafields: { custom: { plp_faq_title: { value: 'Frequently asked questions' }, plp_faq_question_1: { value: 'Which size fits my grill?' }, plp_faq_answer_1: { value: 'Measure width, depth and height.' } } },
};
const articles = [
  { title: 'Winterizing Your Patio', url: '/blogs/journal/winterizing', author: 'Example Outdoor Co.', image: { src: 'files/winter.jpg' }, published_at: '2025-09-10T11:30:00-06:00', updated_at: '2026-06-05T11:53:44-06:00', excerpt: '', content: '<p>Cover "everything"</p>\n\n<p>before the first frost.</p>' },
  { title: 'Outdoor Living Ideas', url: '/blogs/journal/ideas', author: 'Jordan Lee', image: null, published_at: '2026-03-26T07:00:00-06:00', updated_at: '2026-08-11T10:35:54-06:00', excerpt: '<p>Ideas for your space.</p>', content: '' },
];
const blog = { title: 'Journal', url: '/blogs/journal', articles };

const base = { shop, settings, collections, cart: { currency: { iso_code: 'USD' } }, routes: { search_url: '/search' } };
const scenarios = [
  { name: 'home', page_type: 'index', canonical_url: site + '/', page_title: 'Example Outdoor Co.' },
  { name: 'product-group', page_type: 'product', canonical_url: site + '/products/grill-cover', page_title: 'Grill Cover', product: productGroup, section: 'metafield-faq', expect: { manufacturer: true, gtins: 1 } },
  { name: 'product-group-in-collection', page_type: 'product', canonical_url: site + '/products/grill-cover', page_title: 'Grill Cover', product: productGroup, collection: { title: 'Grill Covers', url: '/collections/grill-covers', handle: 'grill-covers' } },
  { name: 'product-single-final-sale', page_type: 'product', canonical_url: site + '/products/loveseat-cover', page_title: 'Loveseat Cover', page_description: 'A &quot;tough&quot; cover &amp; more', product: productSingle, section: 'metafield-faq', expect: { manufacturer: true, gtins: 1 } },
  { name: 'product-resold-other-vendor', page_type: 'product', canonical_url: site + '/products/patio-umbrella', page_title: 'Patio Umbrella', product: productResold, expect: { manufacturer: false, gtins: 1, orgBrandExcludes: site + '/#brand-other-maker-co' } },
  { name: 'product-hierarchy-5-levels', page_type: 'product', canonical_url: site + '/products/chair-cover', page_title: 'Chair Cover Deluxe', product: productHierarchy, expect: { crumbs: ['Home', 'Outdoor Covers', 'Seating Covers', 'Chair Covers', 'Chair Cover Deluxe'] } },
  { name: 'product-hierarchy-depth-3', page_type: 'product', canonical_url: site + '/products/chair-cover', page_title: 'Chair Cover Deluxe', product: productHierarchy, settings: { schema_breadcrumb_max_depth: 3 }, expect: { crumbs: ['Home', 'Chair Covers', 'Chair Cover Deluxe'] } },
  { name: 'collection', page_type: 'collection', canonical_url: site + '/collections/grill-covers', page_title: 'Grill &amp; Smoker Covers', collection, section: 'metafield-faq', expect: { crumbs: ['Home', 'Grill Covers'] } },
  { name: 'collection-hierarchy-4-levels', page_type: 'collection', canonical_url: site + '/collections/chair-covers', page_title: 'Chair Covers', collection: { ...collection, ...chairCovers }, expect: { crumbs: ['Home', 'Outdoor Covers', 'Seating Covers', 'Chair Covers'] } },
  { name: 'product-in-skipped-collection', page_type: 'product', canonical_url: site + '/products/chair-cover', page_title: 'Chair Cover Deluxe', product: productHierarchy, collection: clearance, expect: { crumbs: ['Home', 'Outdoor Covers', 'Seating Covers', 'Chair Covers', 'Chair Cover Deluxe'] } },
  { name: 'collection-breadcrumb-parent', page_type: 'collection', canonical_url: site + '/collections/chair-cushions', page_title: 'Chair Cushions', collection: { ...collection, ...chairCushions }, expect: { crumbs: ['Home', 'Outdoor Covers', 'Seating Covers', 'Chair Cushions'] } },
  { name: 'collection-skipped', page_type: 'collection', canonical_url: site + '/collections/clearance', page_title: 'Clearance', collection: { ...collection, ...clearance }, expect: { crumbs: null } },
  { name: 'collection-hierarchy-loop', page_type: 'collection', canonical_url: site + '/collections/loop-a', page_title: 'Loop A', collection: { ...collection, ...loopA }, expect: { crumbs: ['Home', 'Loop B', 'Loop A'] } },
  { name: 'blog', page_type: 'blog', canonical_url: site + '/blogs/journal', page_title: 'Journal', blog },
  { name: 'article', page_type: 'article', canonical_url: site + '/blogs/journal/winterizing', page_title: 'Winterizing Your Patio', blog, article: articles[0] },
  { name: 'article-person', page_type: 'article', canonical_url: site + '/blogs/journal/ideas', page_title: 'Outdoor Living Ideas', blog, article: articles[1] },
  { name: 'page-about', page_type: 'page', canonical_url: site + '/pages/about-us', page_title: 'About Us', page: { title: 'About Us', handle: 'about-us', template_suffix: '' } },
  { name: 'page-contact', page_type: 'page', canonical_url: site + '/pages/contact', page_title: 'Contact', page: { title: 'Contact', handle: 'contact', template_suffix: 'contact' } },
  { name: 'page-other', page_type: 'page', canonical_url: site + '/pages/warranty', page_title: 'Warranty', page: { title: 'Warranty', handle: 'warranty', template_suffix: '' } },
  { name: 'search', page_type: 'search', canonical_url: site + '/search', page_title: 'Search' },
  { name: '404', page_type: '404', canonical_url: site + '/404', page_title: 'Page not found' },
];
const FAQ_SECTION_SETTINGS = { output_schema: true, default_title: 'Frequently asked questions', color_scheme: { id: 'scheme-1', settings: {} }, max_width: 800, padding: 20, shadow: 4, heading_alignment: 'center', heading_size: 20, heading_color: '#333333', question_size: 16, question_color: '#333333', answer_size: 14, answer_color: '#666666', hover_color: '#007bff', icon_color: '#333333', border_color: '#dddddd' };

function extractBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
// GS1 check: digits only, a GTIN length, and a correct check digit.
function isValidGtin(value) {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;
  const data = value.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += Number(data[i]) * ((data.length - 1 - i) % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(value.slice(-1));
}
function walk(node, fn) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, fn));
  else if (node && typeof node === 'object') { fn(node); Object.values(node).forEach((v) => walk(v, fn)); }
}

// Shopify's Liquid tokenizer ends an output tag at the first "}" (even inside a quoted string), and Shopify
// refuses to save a file with an unterminated tag. LiquidJS is more forgiving, so check this separately.
function shopifyTokenizerProblems() {
  const problems = [];
  for (const dir of ['snippets', 'sections', 'layout', 'blocks']) {
    const full = path.join(themeDir, dir);
    if (!fs.existsSync(full)) continue;
    for (const file of fs.readdirSync(full).filter((f) => f.endsWith('.liquid'))) {
      const text = fs.readFileSync(path.join(full, file), 'utf8');
      const re = /\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}?/g;
      let m;
      while ((m = re.exec(text))) {
        if (m[0].startsWith('{{') && !m[0].endsWith('}}')) {
          const line = text.slice(0, m.index).split('\n').length;
          problems.push(`${dir}/${file}:${line} output tag ends early at "}" (Shopify rejects the file): ${m[0].slice(0, 80)}`);
        }
      }
    }
  }
  return problems;
}

(async () => {
  let failures = 0;
  const tokenizerProblems = shopifyTokenizerProblems();
  console.log(`${tokenizerProblems.length ? 'FAIL' : 'PASS'}  ${'shopify-tokenizer'.padEnd(28)} every {{ }} tag closes the way Shopify parses it`);
  tokenizerProblems.forEach((p) => console.log('      - ' + p));
  if (tokenizerProblems.length) failures++;
  for (const sc of scenarios) {
    const ctx = { ...base, ...sc, settings: { ...settings, ...(sc.settings || {}) }, request: { page_type: sc.page_type, locale: { iso_code: 'en' }, design_mode: false }, page_description: sc.page_description || '' };
    const problems = [];
    let html = '';
    try {
      html = await engine.renderFile('mega-schema', ctx, { globals: ctx });
      if (sc.section) {
        const sectionCtx = { ...ctx, section: { settings: FAQ_SECTION_SETTINGS } };
        html += await engine.renderFile(sc.section, sectionCtx, { globals: sectionCtx });
      }
    } catch (e) {
      problems.push('RENDER ERROR: ' + e.message);
    }
    if (sc.product) {
      // Review apps such as Bazaarvoice inject an untyped block that merges into the product by @id.
      html += `<script type="application/ld+json">{"@context":"https://schema.org/","@id":${JSON.stringify(site + sc.product.url)},"aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":12,"bestRating":5}}</script>`;
    }
    const blocks = extractBlocks(html);
    const ids = new Set();
    const typedIds = new Set();
    const topTypes = new Map();
    const untyped = [];
    const refs = [];
    const types = [];
    let gtinCount = 0;
    let productNode = null;
    let orgNode = null;
    blocks.forEach((b, i) => {
      let json;
      try { json = JSON.parse(b); } catch (e) { problems.push(`JSON block ${i + 1} invalid: ${e.message}`); fs.writeFileSync(path.join(outDir, `${sc.name}.block${i + 1}.bad.txt`), b); return; }
      fs.writeFileSync(path.join(outDir, `${sc.name}.block${i + 1}.json`), JSON.stringify(json, null, 2));
      const top = json['@graph'] || [json];
      top.forEach((n) => types.push(n['@type']));
      walk(json, (n) => {
        const type = n['@type'];
        if ((type === 'Product' || type === 'ProductGroup') && n['@id']) {
          for (const field of ['name', 'description']) if (!n[field]) problems.push(`${type} missing ${field}: ${n['@id']}`);
          if (type === 'Product' && !n.offers) problems.push(`Product missing offers: ${n['@id']}`);
        }
        for (const [key, value] of Object.entries(n)) {
          if (typeof value === 'string' && /&(amp|quot|nbsp|#39|lt|gt);/.test(value)) problems.push(`HTML entity left in ${type || 'node'}.${key}: ${value.slice(0, 60)}`);
          const gtinKey = key.match(/^gtin(8|12|13|14)?$/);
          if (gtinKey) {
            gtinCount++;
            if (!isValidGtin(String(value)) || (gtinKey[1] && String(value).length !== Number(gtinKey[1]))) problems.push(`invalid ${key} "${value}" on ${n['@id'] || type}`);
          }
        }
        if ((type === 'Product' || type === 'ProductGroup') && n['@id'] && sc.product && n['@id'] === site + sc.product.url) productNode = n;
        if (type === 'Organization' && top.includes(n)) orgNode = n;
        if (typeof n.description === 'string' && /\n/.test(n.description)) problems.push(`line breaks left in ${type || 'node'}.description: ${n.description.slice(0, 50)}`);
        if (n['@id'] && Object.keys(n).length > 1) {
          if (type && top.includes(n)) {
            if (typedIds.has(n['@id'])) problems.push('duplicate node @id ' + n['@id']);
            typedIds.add(n['@id']);
            topTypes.set(n['@id'], type);
          } else if (!type && top.includes(n)) untyped.push(n['@id']);
          ids.add(n['@id']);
        } else if (n['@id']) refs.push(n['@id']);
      });
    });
    refs.forEach((r) => { if (!ids.has(r)) problems.push('unresolved reference ' + r); });
    // An unreferenced return policy shows as a stray top-level item in the Schema Markup Validator, and a
    // stray "no returns" policy reads as if the product were final sale.
    [...typedIds].filter((i) => /#return_policy/.test(i) && !refs.includes(i)).forEach((i) => problems.push('return policy node nothing points to: ' + i));
    // The product, breadcrumb and FAQ must stay top-level items in the Schema Markup Validator, which nests any
    // node that another node points to. Non-developers judge the markup by those sections.
    topTypes.forEach((type, i) => { if (['Product', 'ProductGroup', 'BreadcrumbList', 'FAQPage'].includes(type) && refs.includes(i)) problems.push(`${type} is pointed to by another node, so validators nest it instead of listing it: ${i}`); });
    untyped.forEach((u) => { if (!typedIds.has(u)) problems.push(`untyped block ${u} does not merge into a typed node (review app ratings would be lost)`); });
    // Expectations depend on TEST_SETTINGS (owned brands), so they are skipped in defaults-only mode.
    if (orgNode && shop.brand.logo && !orgNode.logo) problems.push('Organization missing logo although a logo is available');
    const expect = process.env.MEGASCHEMA_DEFAULTS_ONLY === '1' ? {} : sc.expect || {};
    if ('manufacturer' in expect && productNode) {
      const hasManufacturer = Boolean(productNode.manufacturer);
      if (hasManufacturer !== expect.manufacturer) problems.push(`manufacturer ${hasManufacturer ? 'present' : 'missing'}; expected ${expect.manufacturer ? 'the company' : 'none'} for vendor "${sc.product.vendor}"`);
    }
    if ('gtins' in expect && gtinCount !== expect.gtins) problems.push(`expected ${expect.gtins} valid GTIN(s), found ${gtinCount}`);
    if ('crumbs' in expect) {
      let crumbNames = null;
      blocks.forEach((b) => { try { const j = JSON.parse(b); (j['@graph'] || [j]).forEach((n) => { if (n['@type'] === 'BreadcrumbList') crumbNames = n.itemListElement.map((i) => i.name); }); } catch {} });
      if (JSON.stringify(crumbNames) !== JSON.stringify(expect.crumbs)) problems.push(`breadcrumb ${JSON.stringify(crumbNames)}; expected ${JSON.stringify(expect.crumbs)}`);
    }
    if (expect.orgBrandExcludes && orgNode && (orgNode.brand || []).some((b) => b['@id'] === expect.orgBrandExcludes)) problems.push(`Organization.brand claims ${expect.orgBrandExcludes}, a brand the company does not own`);
    if (!blocks.length && !problems.length) problems.push('no JSON-LD output');
    if (problems.length) failures++;
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${sc.name.padEnd(28)} blocks=${blocks.length} nodes: ${types.join(', ')}`);
    problems.forEach((p) => console.log('      - ' + p));
  }
  console.log(failures ? `\n${failures} scenario(s) failed` : '\nAll scenarios passed');
  process.exitCode = failures ? 1 : 0;
})();
