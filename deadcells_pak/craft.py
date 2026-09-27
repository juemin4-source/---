#!/usr/bin/env python3
"""How hand-made rooms are built: GID usage, object vocabulary, decoration density, room template families."""
import struct, zlib, base64, re, os, collections, io, sys
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

# ---- 1. GID vocabulary across ALL rooms ----
col_gids = collections.Counter()
lnk_gids = collections.Counter()
# ---- 2. Object vocabulary (markers) ----
obj_types = collections.Counter()
# ---- 3. Decoration density: non-floor GID cells per room (col layer, GID!=0 != wall?) ----
# col layer: GID 0 = floor, GID 1..7 = wall/decoration tiles from col.tsx (7 tiles)
# Actually col.tsx has 7 tiles; GID 1-7. Distinguish wall vs decoration by where used.
rooms = []
for bi in sorted(os.listdir(BASE)):
    bp = os.path.join(BASE, bi)
    if not os.path.isdir(bp): continue
    for f in sorted(os.listdir(bp)):
        if not f.endswith('.tmx'): continue
        fp = os.path.join(bp, f)
        try:
            tw, th, mw, mh, _ = header(fp)
            gs, d = grids(fp, mw, mh)
            if not gs: continue
            for g in gs[0]: col_gids[g] += 1
            if len(gs) > 1:
                for g in gs[1]: lnk_gids[g] += 1
            # object types
            i = 0
            while True:
                i = d.find(b'\xff\xff\xff\xff', i)
                if i < 0: break
                for tlen in range(2, 24):
                    if i-1-tlen < 0: continue
                    if d[i-1-tlen] != tlen: continue
                    t = d[i-tlen:i]
                    if all(32 <= c < 127 for c in t):
                        obj_types[t.decode()] += 1
                        break
                i += 4
            rooms.append((bi, f, mw, mh))
        except Exception:
            pass

print('=== col layer GID usage (all %d rooms) ===' % len(rooms))
for g, c in sorted(col_gids.items()):
    print('  GID %-3d : %d cells' % (g, c))
print('=== lnk layer GID usage ===')
for g, c in sorted(lnk_gids.items()):
    print('  GID %-3d : %d cells' % (g, c))
print('=== object/marker vocabulary (top 30) ===')
for t, c in obj_types.most_common(30):
    print('  %-28s %6d' % (t, c))
print('total object markers:', sum(obj_types.values()))
