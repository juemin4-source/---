#!/usr/bin/env python3
"""Room production pipeline: layer count, auto-decoration params, decoration object ratios."""
import struct, zlib, base64, re, os, collections, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, 'res_extracted/tiled/tmx')
B64 = re.compile(rb'[A-Za-z0-9+/=]{40,}')

def header(path):
    d = open(path, 'rb').read()
    for off in range(8, 28):
        tw, th, mw, mh = struct.unpack_from('<HHHH', d, off)
        if tw == th and 4 <= mw <= 512 and 4 <= mh <= 512 and tw <= 128:
            return tw, th, mw, mh, d
    raise ValueError

# 1. grid (tile-layer) count per room
grid_hist = collections.Counter()
# 2. flip-flag usage in col GIDs
flip_v = flip_h = both = 0
# 3. wall palette: GID 1..7 share
wall_share = collections.Counter()
for bi in sorted(os.listdir(BASE)):
    bp = os.path.join(BASE, bi)
    if not os.path.isdir(bp): continue
    for f in sorted(os.listdir(bp)):
        if not f.endswith('.tmx'): continue
        fp = os.path.join(bp, f)
        try:
            tw, th, mw, mh, _ = header(fp)
        except Exception:
            continue
        d = open(fp, 'rb').read()
        want = mw*mh*4
        grids = []
        for m in B64.finditer(d):
            b64 = m.group()
            try: dec = zlib.decompress(base64.b64decode(b64 + b'='*(-len(b64)%4)))
            except: continue
            if len(dec) == want:
                grids.append(struct.unpack('<%dI'%(want//4), dec))
        grid_hist[len(grids)] += 1
        if grids:
            for g in grids[0]:
                if g == 0: continue
                base = g & 0x3FFFFFFF
                if g & (1 << 30): flip_v += 1
                if g & (1 << 31): flip_h += 1
                if 1 <= base <= 7:
                    wall_share[base] += 1
print('tile-layer count per room:')
for k, c in sorted(grid_hist.items()):
    print('  %d grids : %d rooms' % (k, c))
tot = sum(wall_share.values())
print('wall-tile palette (col GID 1-7, %d wall cells):' % tot)
for g in range(1, 8):
    print('  tile %d : %6d cells (%.1f%%)' % (g, wall_share[g], wall_share[g]/tot*100))
print('flip flags: vertical=%d horizontal=%d' % (flip_v, flip_h))

# 4. biome auto-decoration params
cdb = json.load(open(os.path.join(HERE, 'res_extracted/data.cdb'), encoding='utf-8'))
bio = [s for s in cdb['sheets'] if s['name'] == 'biome'][0]
rows = []
for ln in bio.get('lines', []):
    if isinstance(ln, dict):
        rows.append(ln)
print('\nbiome auto-decoration params (biome sheet):')
print('%-20s %6s %6s %6s %8s %s' % ('biome', 'veg', 'fJunk', 'wJunk', 'stamps', 'oneWayOpaque'))
for r in rows[:63]:
    stamps = r.get('floorStamps', 0)
    if isinstance(stamps, list):
        stamps = len(stamps)
    print('%-20s %6s %6s %6s %8s %s' % (
        str(r.get('id'))[:20], r.get('vegetation'), r.get('floorJunkDensity'),
        r.get('wallJunkDensity'), stamps, r.get('oneWayOpaque')))
