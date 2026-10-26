// Genesis Lifestyle — product share pages (Facebook/WhatsApp preview) + auto sitemap
// /p/<product-code> returns a page with the product name, image and price; browsers are sent on to the normal product page.
const SB_URL = 'https://eivbfwwapalxxegxrndc.supabase.co';
const SB_KEY = 'sb_publishable_wCiaA3nANyjWU6-hi_FrTg_UqX9pBXv'; // public key (also in the site)
const SITE = 'https://genesislifestylebd.com';

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const absImg = (u, id, i) => /^data:/i.test(u) ? SITE + '/pi/' + id + '/' + i : /^https?:\/\//i.test(u) ? u : SITE + '/' + encodeURI(String(u).replace(/^\/+/, ''));

async function sb(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: { apikey: SB_KEY } });
  if (!r.ok) throw new Error('supabase ' + r.status);
  return r.json();
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    try {
      if (u.pathname === '/sitemap.xml') return await sitemap(req, env);
      const m = u.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/);
      if (m) return await productPage(req, env, m[1]);
      const im = u.pathname.match(/^\/pi\/([A-Za-z0-9_-]+)\/(\d+)$/);
      if (im) return await productImage(im[1], Number(im[2]));
    } catch (e) { /* fall through to the normal site */ }
    if (u.pathname.startsWith('/p/')) return Response.redirect(SITE + '/#/shop', 302);
    return env.ASSETS.fetch(req);
  }
};

function buildProductHtml(html, p, id) {
  const imgs = (Array.isArray(p.images) ? p.images : []).map((x, i) => x ? absImg(x, id, i) : '').filter(Boolean);
  const img = imgs[0] || SITE + '/og.jpg';
  const price = Number(p.price) || 0;
  const desc = ((p.description || '').replace(/\s+/g, ' ').trim().slice(0, 180) + (price ? ' | মূল্য ৳' + price : '')).trim() || 'Genesis Lifestyle, বগুড়া';
  const title = p.name + ' | Genesis Lifestyle';
  const url = SITE + '/p/' + id;
  const stock = p.stock && typeof p.stock === 'object' ? Object.values(p.stock) : [];
  const inStock = !stock.length || stock.some(n => Number(n) > 0);
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: id, image: imgs.length ? imgs : [img],
    description: (p.description || '').slice(0, 500), category: p.category, brand: { '@type': 'Brand', name: 'Genesis Lifestyle' },
    offers: { '@type': 'Offer', url, priceCurrency: 'BDT', price: String(price), itemCondition: 'https://schema.org/NewCondition', availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }
  }).replace(/</g, '\\u003c');
  const rep = (re, to) => { html = html.replace(re, () => to); };
  rep(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>');
  rep(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(desc) + '">');
  rep(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(p.name) + '">');
  rep(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(desc) + '">');
  rep(/<meta property="og:type" content="[^"]*">/, '<meta property="og:type" content="product">');
  rep(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">');
  rep(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + esc(img) + '">');
  rep(/<meta property="og:image:width" content="[^"]*">\s*/, '');
  rep(/<meta property="og:image:height" content="[^"]*">\s*/, '');
  rep(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + esc(img) + '">');
  rep(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">');
  rep(/<head>/, '<head><script>location.replace(' + JSON.stringify(SITE + '/#/product/' + id).replace(/</g, '\\u003c') + ')</script><script type="application/ld+json">' + ld + '</script>');
  return html;
}

async function productPage(req, env, id) {
  const rows = await sb('products?id=eq.' + encodeURIComponent(id) + '&select=*');
  const p = rows[0];
  if (!p || p.active === false) return Response.redirect(SITE + '/#/shop', 302);
  const home = await env.ASSETS.fetch(new Request(new URL('/', req.url)));
  const out = buildProductHtml(await home.text(), p, id);
  return new Response(out, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}

async function sitemap(req, env) {
  let rows;
  try { rows = await sb('products?select=id,active'); } catch (e) {
    try { rows = await sb('products?select=id'); } catch (e2) { return env.ASSETS.fetch(req); }
  }
  const urls = [SITE + '/'].concat(rows.filter(r => r.active !== false && /^[A-Za-z0-9_-]+$/.test(r.id)).map(r => SITE + '/p/' + r.id));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((x, i) => '<url><loc>' + x + '</loc><changefreq>weekly</changefreq><priority>' + (i ? '0.7' : '1.0') + '</priority></url>').join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

async function productImage(id, i) {
  const rows = await sb('products?id=eq.' + encodeURIComponent(id) + '&select=images');
  const u = rows[0] && Array.isArray(rows[0].images) ? rows[0].images[i] : '';
  if (!u) return new Response('not found', { status: 404 });
  const d = String(u).match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (d) {
    const bin = atob(d[2]), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return new Response(bytes, { headers: { 'content-type': d[1], 'cache-control': 'public, max-age=86400' } });
  }
  return Response.redirect(absImg(u, id, i), 302);
}
