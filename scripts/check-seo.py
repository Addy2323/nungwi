"""Read-only production smoke check. Start Next on port 3002 before running."""
import json
import re
import struct
import urllib.request
import urllib.error
import urllib.parse
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

BASE = 'http://localhost:3002'
CANONICAL = 'https://vunjabeiliquorzanzibar.co.tz'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def fetch(path, headers=None):
    try:
        response = urllib.request.build_opener(NoRedirect).open(urllib.request.Request(BASE+path, headers=headers or {}), timeout=90)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, {key.lower(): value for key, value in response.headers.items()}, response.read()

class Document(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.h1 = 0; self.title = ''; self.in_title = False; self.canonical = ''; self.meta = {}; self.schemas = []; self.json_text = None; self.images = []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1': self.h1 += 1
        if tag == 'title': self.in_title = True
        if tag == 'link' and attrs.get('rel') == 'canonical': self.canonical = attrs['href']
        if tag == 'meta': self.meta[attrs.get('name',attrs.get('property',''))] = attrs.get('content','')
        if tag == 'script' and attrs.get('type') == 'application/ld+json': self.json_text = ''
        if tag == 'img': self.images.append(attrs)
    def handle_data(self, data):
        if self.in_title: self.title += data
        if self.json_text is not None: self.json_text += data
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        if tag == 'script' and self.json_text is not None:
            self.schemas.append(json.loads(self.json_text)); self.json_text = None

results = {}
status, headers, robots = fetch('/robots.txt')
assert status == 200 and ('text/plain' in headers.get('content-type',''))
assert CANONICAL+'/sitemap.xml' in robots.decode()
results['robots'] = {'status':status, 'content_type':headers.get('content-type'), 'body':robots.decode()}
status, headers, sitemap = fetch('/sitemap.xml')
assert status == 200 and 'xml' in headers.get('content-type','')
urls = [node.text for node in ET.fromstring(sitemap).findall('{*}url/{*}loc')]
assert all(url.startswith(CANONICAL+'/') for url in urls)
assert not any(any(private in url for private in ['/checkout','/customer','/dashboard','/hotel','/login','/delivery']) for url in urls)
results['sitemap'] = {'status':status, 'content_type':headers.get('content-type'), 'urls':urls}
titles = set()
pages = []
for url in urls:
    path = url[len(CANONICAL):]
    status, headers, raw = fetch(path)
    assert status == 200, (path,status)
    doc = Document(raw.decode())
    assert doc.h1 == 1, (path,doc.h1)
    assert doc.title and doc.title not in titles, (path,doc.title)
    titles.add(doc.title)
    assert doc.canonical.rstrip('/') == url.rstrip('/'), (path,doc.canonical,url)
    assert 'noindex' not in doc.meta.get('robots','')
    assert doc.meta.get('og:image') and doc.meta.get('twitter:card') == 'summary_large_image'
    assert doc.meta.get('description')
    assert any(s.get('@type') in ['Organization','LiquorStore'] for s in doc.schemas)
    assert all('alt' in image for image in doc.images)
    if path.startswith('/products/'):
        schema = next(s for s in doc.schemas if s.get('@type') == 'Product')
        assert schema['offers']['priceCurrency'] == 'TZS'
        assert isinstance(schema['offers']['price'], (int,float))
        assert schema['offers']['availability'] in ['https://schema.org/InStock','https://schema.org/OutOfStock']
        assert any(s.get('@type') == 'BreadcrumbList' for s in doc.schemas)
    if path.startswith('/categories/') or path == '/shop':
        assert any(s.get('@type') == 'ItemList' for s in doc.schemas)
    pages.append({'path':path,'title':doc.title,'title_length':len(doc.title),'description_length':len(doc.meta['description']),'h1':doc.h1,'canonical':doc.canonical,'schemas':[s.get('@type') for s in doc.schemas]})
results['pages'] = pages
results['auth'] = {}
for path in ['/checkout','/customer','/dashboard','/hotel']:
    status, headers, raw = fetch(path)
    # App Router may flush loading.tsx before a server-side redirect is resolved.
    streamed = re.search(r'<meta[^>]+id="__next-page-redirect"[^>]+content="\d+;url=(/login[^\"]*)"', raw.decode())
    assert (status in [307,308] and headers.get('location','').startswith('/login')) or (status == 200 and streamed), (path,status,headers)
    assert 'noindex' in headers.get('x-robots-tag','')
    results['auth'][path] = {'status':status,'location':headers.get('location') or streamed.group(1),'x_robots_tag':headers.get('x-robots-tag')}
for path in ['/login','/signup','/auth','/forgot-password','/reset-password','/accept-invitation']:
    status, headers, raw = fetch(path)
    doc = Document(raw.decode())
    assert status == 200 and doc.h1 == 1 and 'noindex' in doc.meta.get('robots',''), (path,status,doc.h1)
status, headers, _ = fetch('/shop?test=canonical', {'Host':'www.vunjabeiliquorzanzibar.co.tz'})
assert status == 301 and headers['location'] == CANONICAL+'/shop?test=canonical'
results['www_redirect'] = {'status':status,'location':headers['location']}
status, headers, image = fetch('/og')
assert status == 200 and struct.unpack('>II',image[16:24]) == (1200,630)
results['og'] = {'status':status,'size':[1200,630],'content_type':headers.get('content-type')}
Path('design/seo-verification.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(f'PASS: {len(pages)} public sitemap pages, metadata, JSON-LD, headings, private-route auth/noindex, 301 host redirect, robots, sitemap and 1200x630 OG image.')
