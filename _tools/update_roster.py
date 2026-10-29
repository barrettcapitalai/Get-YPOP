
# YPOP roster sync. Reads the "Full List" tab of the YPOP roster Google Sheet,
# rebuilds the encrypted roster data, and commits roster/index.html to GitHub
# only when something changed. Run inside the Composio workbench with PASS set.
import re, json, os, io, base64, hmac, hashlib, datetime, concurrent.futures
import requests
from PIL import Image
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

SHEET_ID = '1A6u1Xy7N4F_BQZNl8fIkXoBkoyUOr2zQg0LeQFJ2U0Q'
OWNER, REPO, BRANCH, PAGE = 'barrettcapitalai', 'Get-YPOP', 'main', 'roster/index.html'
BLOCKS = ['Celebrities','Artists & Musicians','Creators & Entertainment','Fitness Influencers','Athletes & Sports','SRGN League Players','Fashion & Sneakers','Business, Finance & Real Estate','Brands & Businesses','Gyms & Fitness Brands','Agencies & NIL','Platforms & Tech','Government & Tourism','Connectors & Partners','To categorize']
DRY = globals().get('DRY', False)
MAX_NEW = globals().get('MAX_NEW', 40)      # new photo lookups per run
IMG_DIR = 'roster/img'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9'}

# ---------- photos & logos ----------
def _clean(h):
    h = re.sub(r'\s*\+\d+$', '', h.split('~')[0]); h = re.sub(r'\s*\(.*?\)', '', h).strip()
    return h[2:].strip() if h.lower().startswith('x @') else h
def _img(b):
    try:
        im = Image.open(io.BytesIO(b)); im.load()
        return im if min(im.size) >= 48 else None
    except Exception: return None
def _yt(h):
    h = _clean(h)
    if not h: return None
    m = re.search(r'(UC[\w-]{20,})', h)
    url = 'https://www.youtube.com/channel/' + m.group(1) if m else ('https://www.youtube.com/@' + h.lstrip('@') if re.fullmatch(r'@?[A-Za-z0-9._-]+', h) else None)
    if not url: return None
    r = requests.get(url, headers=UA, timeout=15)
    m = re.search(r'<meta property="og:image" content="([^"]+)"', r.text) if r.ok else None
    if not m: return None
    i = requests.get(m.group(1), headers=UA, timeout=15)
    return _img(i.content) if i.ok else None
def _una(kind, h):
    h = _clean(h).lstrip('@')
    if not h or not re.fullmatch(r'[A-Za-z0-9._-]+', h): return None
    r = requests.get('https://unavatar.io/%s/%s?fallback=false' % (kind, h), headers=UA, timeout=15)
    return _img(r.content) if r.ok and r.headers.get('content-type', '').startswith('image') else None
def _site(w):
    if not w: return None
    r = requests.get('https://www.google.com/s2/favicons?domain=%s&sz=256' % w.split('/')[0], headers=UA, timeout=15)
    im = _img(r.content) if r.ok else None
    return im if im and min(im.size) >= 64 else None
def find_photo(f):
    for fn in (lambda: _yt(f[6]), lambda: _una('tiktok', f[5]), lambda: _una('x', f[7]), lambda: _site(f[9])):
        try:
            im = fn()
            if im: return im
        except Exception: pass
    return None
def to_jpeg(im):
    im = im.convert('RGBA'); bg = Image.new('RGBA', im.size, (255, 255, 255, 255)); bg.alpha_composite(im); im = bg.convert('RGB')
    w, h = im.size; s = min(w, h); im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((160, 160), Image.LANCZOS)
    out = io.BytesIO(); im.save(out, 'JPEG', quality=82, optimize=True); return base64.b64encode(out.getvalue()).decode()
def list_dir(path):
    r, e = run_composio_tool('GITHUB_GET_REPOSITORY_CONTENT', {'owner': OWNER, 'repo': REPO, 'path': path, 'ref': BRANCH})
    if e: return []
    c = _data(r).get('content', [])
    return [x.get('name') for x in c] if isinstance(c, list) else []
def read_text(path):
    r, e = run_composio_tool('GITHUB_GET_REPOSITORY_CONTENT', {'owner': OWNER, 'repo': REPO, 'path': path, 'ref': BRANCH})
    if e: return ''
    c = _data(r).get('content', {})
    c = c.get('content') if isinstance(c, dict) else None
    return base64.b64decode(c).decode('utf-8') if c else ''
def commit(files, message):
    r, e = run_composio_tool('GITHUB_COMMIT_MULTIPLE_FILES', {'owner': OWNER, 'repo': REPO, 'branch': BRANCH, 'message': message, 'upserts': files})
    if e: raise RuntimeError('commit failed: %s' % e)


def _data(r):
    return r.get('data', r) if isinstance(r, dict) else r

def read_sheet():
    r, e = run_composio_tool('GOOGLESHEETS_BATCH_GET', {'spreadsheet_id': SHEET_ID, 'ranges': ["'Full List'!A1:AZ2000"]})
    if e: raise RuntimeError('sheet read failed: %s' % e)
    vrs = _data(r).get('valueRanges', [])
    return vrs[0].get('values', []) if vrs else []

def num(s):
    s = str(s or '').strip()
    if not s or 'like' in s.lower() or s.lower() in ('-', 'not shown', 'n/a') or s.startswith('<'): return 0
    m = re.match(r'^~?\s*([\d,]*\.?\d+)\s*([kKmMbB]?)\+?$', s.replace(' ', ''))
    if not m: return 0
    return int(round(float(m.group(1).replace(',', '')) * {'': 1, 'k': 1e3, 'm': 1e6, 'b': 1e9}[m.group(2).lower()]))
def count(cell): return sum(num(p) for p in re.split(r'[\n\r]+', str(cell or '')) if p.strip())
def handles(cell): return [p.strip() for p in re.split(r'[\n\r]+', str(cell or '')) if p.strip() and p.strip() != '-']

def group(cat, niche, name):
    c, nl = cat.strip(), niche.strip().lower(); cl = c.lower()
    if c == 'CELEBRITY': return 'Celebrities'
    if c in ('Music', 'Tattoo artist') or 'art & science' in nl or 'live entertainment' in nl: return 'Artists & Musicians'
    if c == 'Fitness / Health / Gym':
        return 'Gyms & Fitness Brands' if ('gym' in nl and 'owner' not in nl) or 'facility' in nl or name == 'Sucka Free Fitness' else 'Fitness Influencers'
    if c == 'CREATOR' and ('fitness' in nl or 'bodybuild' in nl or 'powerlift' in nl): return 'Fitness Influencers'
    if c in ('CREATOR', 'Entertainment & media', 'MOVIES', 'Food'): return 'Creators & Entertainment'
    if c == 'SRGN league player': return 'SRGN League Players'
    if c in ('NFL', 'Athlete/Motorsport', 'Coaching & training', 'Combat sports / sports business') or cl in ('athlete', 'athletes', 'sports'): return 'Athletes & Sports'
    if c == 'Sneakers & fashion' or 'sneaker' in cl: return 'Fashion & Sneakers'
    if c.upper() == 'AGENCY' or c == 'NIL Collective': return 'Agencies & NIL'
    if c in ('Brands', 'PODCAST'): return 'Brands & Businesses'
    if c in ('PLATFORM', 'TECH'): return 'Platforms & Tech'
    if c == 'GOV': return 'Government & Tourism'
    if c == 'CONNECTOR': return 'Connectors & Partners'
    if not c: return 'Connectors & Partners' if name == 'Stearns Bank' else 'To categorize'
    return 'Business, Finance & Real Estate'

CAT_OF = {}
def top_cat(block, cat):
    c = cat.strip().upper()
    if block == 'Celebrities': return 'CE'
    if block == 'Artists & Musicians': return 'EN'
    if block == 'Creators & Entertainment': return 'IN' if c in ('CREATOR', 'FOOD') else 'EN'
    if block in ('Fitness Influencers', 'Business, Finance & Real Estate', 'Fashion & Sneakers'): return 'IN'
    if block in ('Athletes & Sports', 'SRGN League Players'): return 'AT'
    if block == 'Agencies & NIL': return 'AG'
    if block == 'Platforms & Tech': return 'PL'
    return 'BP'

def web(o):
    m = re.search(r'(https?://[^\s|]+|\b[a-z0-9][a-z0-9.-]*\.(?:com|tv|net|io|co|org|ai|cc)\b)', o or '', re.I)
    if not m: return ''
    w = re.sub(r'^https?://(www\.)?', '', m.group(1)).rstrip('/')
    return '' if w.lower() in ('facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'x.com', 'linkedin.com') else w

def build_lines(vals):
    H = vals[1]; ix = {h.strip(): i for i, h in enumerate(H) if h and h.strip()}
    need = ['Status', 'Category', 'Industry / niche', 'Instagram', 'IG followers', 'TikTok', 'TikTok followers', 'YouTube', 'YouTube subs', 'X', 'X followers', 'Facebook', 'Facebook followers', 'Twitch followers', 'Discord members', 'Other platforms']
    miss = [k for k in need if k not in ix]
    if miss: raise RuntimeError('Full List is missing columns: %s' % miss)
    G = lambda r, k: (r[ix[k]] if ix[k] < len(r) else '') or ''
    PL = [('Instagram', 'IG followers'), ('TikTok', 'TikTok followers'), ('YouTube', 'YouTube subs'), ('X', 'X followers'), ('Facebook', 'Facebook followers')]
    recs = {}
    for r in vals[2:]:
        if not r or not str(r[0]).strip(): continue
        name = str(r[0]).strip().replace('|', '/')
        cells, tot = [], 0
        for h, f in PL:
            hs = [x.replace('|', '/').replace('~', '-') for x in handles(G(r, h))]; n = count(G(r, f)); tot += n
            s = hs[0] if hs else ''
            if len(hs) > 1: s += ' +%d' % (len(hs) - 1)
            cells.append('%s~%d' % (s, n) if n else s)
        tot += count(G(r, 'Twitch followers')) + count(G(r, 'Discord members'))
        cat, niche = str(G(r, 'Category')), str(G(r, 'Industry / niche'))
        ind = (niche.strip() or cat.strip()).replace('|', '/')
        blk = group(cat, niche, name); g = BLOCKS.index(blk)
        CAT_OF[name] = top_cat(blk, cat)
        line = '|'.join([name, str(g), ind, str(G(r, 'Status')).strip().replace('|', '/')] + cells + [web(G(r, 'Other platforms')), str(tot) if tot else ''])
        if name in recs and recs[name][1] >= tot: continue
        recs[name] = (line, tot)
    return [v[0] for k, v in sorted(recs.items(), key=lambda kv: kv[0].lower())], sum(v[1] for v in recs.values())

def encrypt(txt, pw):
    salt, iv, it = os.urandom(16), os.urandom(12), 310000
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=it).derive(pw.encode())
    ct = AESGCM(key).encrypt(iv, txt.encode('utf-8'), None)
    b = lambda x: base64.b64encode(x).decode()
    return json.dumps({'s': b(salt), 'v': b(iv), 'i': it, 'c': b(ct)}, separators=(',', ':'))

def get_page():
    r, e = run_composio_tool('GITHUB_GET_REPOSITORY_CONTENT', {'owner': OWNER, 'repo': REPO, 'path': PAGE, 'ref': BRANCH})
    if e and ('404' in str(e) or 'Not Found' in str(e)): return None
    if e: raise RuntimeError('could not read %s from GitHub: %s' % (PAGE, e))
    d = _data(r); c = d.get('content', d)
    if isinstance(c, dict): c = c.get('content')
    if isinstance(c, list): raise RuntimeError('%s is a folder, not a file' % PAGE)
    return base64.b64decode(c).decode('utf-8')

def run(PASS):
    vals = read_sheet()
    lines, total = build_lines(vals)
    if len(lines) < 25: raise RuntimeError('Only %d rows parsed; refusing to publish (sheet may be empty or restructured).' % len(lines))
    # photos: one file per person, named by a keyed hash so names are not exposed
    have = set(n[:-4] for n in list_dir(IMG_DIR) if n.endswith('.jpg'))
    miss_txt = read_text(IMG_DIR + '/_miss.txt'); misses = set(miss_txt.split())
    retry = datetime.datetime.utcnow().hour == 9          # retry earlier misses once a day
    keys, todo = [], []
    for l in lines:
        f = l.split('|'); k = hmac.new(PASS.encode(), ('img:' + f[0]).encode(), hashlib.sha256).hexdigest()[:20]; keys.append(k)
        if k not in have and (retry or k not in misses) and len(todo) < MAX_NEW: todo.append((k, f))
    new_imgs = {}
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        for k, im in zip([t[0] for t in todo], ex.map(lambda t: find_photo(t[1]), todo)):
            if im:
                try: new_imgs[k] = to_jpeg(im)
                except Exception: pass
    misses = (misses | set(k for k, _ in todo)) - set(new_imgs) - have
    lines = [l + '|' + (k if (k in have or k in new_imgs) else '') + '|' + CAT_OF.get(l.split('|')[0], 'BP') for l, k in zip(lines, keys)]
    img_files = [{'path': '%s/%s.jpg' % (IMG_DIR, k), 'content': b, 'encoding': 'base64'} for k, b in new_imgs.items()]
    if not DRY:
        for i in range(0, len(img_files), 25):
            commit(img_files[i:i + 25], 'Roster photos: %d new' % len(img_files[i:i + 25]))
        if todo and '\n'.join(sorted(misses)) != '\n'.join(sorted(miss_txt.split())):
            commit([{'path': IMG_DIR + '/_miss.txt', 'content': '\n'.join(sorted(misses)) + '\n', 'encoding': 'utf-8'}], 'Roster photos: update lookup list')
    txt = '\n'.join(lines)
    sig = hmac.new(PASS.encode(), txt.encode('utf-8'), hashlib.sha256).hexdigest()
    page = get_page()
    if page is None: return 'WAITING: %s is not in the GitHub repo yet; nothing published.' % PAGE
    if 'var ENC=' not in page: raise RuntimeError('roster page has no ENC payload marker')
    m = re.search(r'<meta name="ypop-roster-sig" content="([0-9a-f]+)">', page)
    summary = '%d people, %s combined reach' % (len(lines), '{:,}'.format(total))
    if m and m.group(1) == sig:
        return 'NO CHANGE: roster already up to date (%s).' % summary
    stamp = datetime.datetime.utcnow().strftime('%b %d, %Y %H:%M UTC')
    new = re.sub(r'var ENC=\{.*?\};', lambda _: 'var ENC=' + encrypt(txt, PASS) + ';', page, count=1, flags=re.S)
    if m: new = new.replace(m.group(0), '<meta name="ypop-roster-sig" content="%s">' % sig)
    else: new = new.replace('<meta name="robots"', '<meta name="ypop-roster-sig" content="%s">\n<meta name="robots"' % sig, 1)
    new = re.sub(r'(Figures checked [^.<]*\.|Last synced from the roster sheet [^.<]*\.)', 'Last synced from the roster sheet %s.' % stamp.replace(',', ''), new, count=1)
    if DRY: return 'DRY RUN: would publish %s' % summary
    commit([{'path': PAGE, 'content': new, 'encoding': 'utf-8'}], 'Roster sync: %s' % summary)
    return 'UPDATED: published %s (%d new photos).' % (summary, len(new_imgs))
