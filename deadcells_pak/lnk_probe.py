#!/usr/bin/env python3
"""Decode lnk layer meaning + per-room object density."""
import struct, zlib, base64, re, os, collections, io, sys, statistics
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

def grids(path, mw, mh):
    d = open(path, 'rb').read()
    want = mw*mh*4; out=[]
    for m in B64.finditer(d):
        b64 = m.group()
        try: dec = zlib.decompress(base64.b64decode(b64 + b'='*(-len(b64)%4)))
        except: continue
        if len(dec)==want: out.append(struct.unpack('<%dI'%(want//4), dec))
    return out, d

# 1. render lnk of Pr1
tw, th, mw, mh, _ = header(os.path.join(BASE, 'Prison/Pr1.tmx'))
gs, d = grids(os.path.join(BASE, 'Prison/Pr1.tmx'), mw, mh)
col, lnk = gs[0], gs[1]
print('Pr1 45x20 — col vs lnk (col: . floor / # wall | lnk overlay on top)')
for y in range(mh):
    line = ''
    for x in range(mw):
        c = col[y*mw+x]
        l = lnk[y*mw+x]
        if l != 0:
            line += 'L' if c == 0 else 'W'
        else:
            line += '.' if c == 0 else '#'
    print(line)
# lnk GID placement: where (floor/edge/wall)
loc = collections.Counter()
for y in range(mh):
    for x in range(mw):
        l = lnk[y*mw+x]
        if l == 0: continue
        c = col[y*mw+x]
        edge = (x == 0 or x == mw-1 or y == 0 or y == mh-1)
        loc[(c == 0, edge)] += 1
print('lnk placement (floor?, on_edge?):', dict(loc))

# 2. per-room object counts
def objects(fp):
    dd = open(fp, 'rb').read()
    n = 0; i = 0
    while True:
        i = dd.find(b'\xff\xff\xff\xff', i)
        if i < 0: break
        for tlen in range(2, 24):
            if i-1-tlen < 0: continue
            if dd[i-1-tlen] != tlen: continue
            t = dd[i-tlen:i]
            if all(32 <= c < 127 for c in t):
                n += 1
                break
        i += 4
    return n

counts = []
for bi in sorted(os.listdir(BASE)):
    bp = os.path.join(BASE, bi)
    if not os.path.isdir(bp): continue
    for f in sorted(os.listdir(bp)):
        if f.endswith('.tmx'):
            try:
                counts.append(objects(os.path.join(bp, f)))
            except Exception:
                pass
counts.sort()
print('\nobjects per room: min=%d med=%d mean=%.1f p90=%d max=%d' % (
    counts[0], counts[len(counts)//2], sum(counts)/len(counts), counts[int(len(counts)*.9)], counts[-1]))
# distribution buckets
b = collections.Counter()
for c in counts:
    if c == 0: b[0] += 1
    elif c <= 5: b[1] += 1
    elif c <= 15: b[2] += 1
    elif c <= 40: b[3] += 1
    else: b[4] += 1
print('buckets {0,1-5,6-15,16-40,40+}:', dict(sorted(b.items())))
