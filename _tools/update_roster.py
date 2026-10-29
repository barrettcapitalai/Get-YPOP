
# YPOP roster sync. Reads the "Full List" tab of the YPOP roster Google Sheet,
# rebuilds the encrypted roster data, and commits roster/index.html to GitHub
# only when something changed. Run inside the Composio workbench with PASS set.
import re, json, os, base64, hmac, hashlib, datetime
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

SHEET_ID = '1A6u1Xy7N4F_BQZNl8fIkXoBkoyUOr2zQg0LeQFJ2U0Q'
OWNER, REPO, BRANCH, PAGE = 'barrettcapitalai', 'Get-YPOP', 'main', 'roster/index.html'
BLOCKS = ['Celebrities','Artists & Musicians','Creators & Entertainment','Fitness Influencers','Athletes & Sports','SRGN League Players','Fashion & Sneakers','Business, Finance & Real Estate','Brands & Businesses','Gyms & Fitness Brands','Agencies & NIL','Platforms & Tech','Government & Tourism','Connectors & Partners','To categorize']
DRY = globals().get('DRY', False)

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
        g = BLOCKS.index(group(cat, niche, name))
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
    r, e = run_composio_tool('GITHUB_COMMIT_MULTIPLE_FILES', {'owner': OWNER, 'repo': REPO, 'branch': BRANCH,
        'message': 'Roster sync: %s' % summary, 'upserts': [{'path': PAGE, 'content': new, 'encoding': 'utf-8'}]})
    if e: raise RuntimeError('commit failed: %s' % e)
    return 'UPDATED: published %s.' % summary
