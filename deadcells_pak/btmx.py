#!/usr/bin/env python3
"""Dead Cells BTMX decoder (robust variant).
Header: 'BTMX' u8 fmtver str tiled_ver str tiled_build u16 tw u16 th u16 mw u16 mh ...
Tile grids: every base64 run in the file that zlib-decompresses to exactly mw*mh*4 bytes
is a tile grid; 1st = collision, 2nd = link/door layer (lnk.tsx, GID 1..8 = door tiles).
Door sides: an lnk border cell (row0/rowlast/col0/colN) with GID>0 => door on that side.
"""
import struct, zlib, base64, os, sys, re, json, collections

B64 = re.compile(rb'[A-Za-z0-9+/=]{40,}')

def rstr(d, p):
    n = d[p]; p += 1
    return d[p:p+n].decode('utf-8', 'replace'), p + n

def header_dims(path):
    d = open(path, 'rb').read()
    p = 5
    _, p = rstr(d, p)
    _, p = rstr(d, p)
    tw, th, mw, mh = struct.unpack_from('<HHHH', d, p)
    return tw, th, mw, mh, d

def find_grids(d, mw, mh):
    want = mw * mh * 4
    grids = []
    for m in B64.finditer(d):
        b64 = m.group()
        try:
            dec = zlib.decompress(base64.b64decode(b64 + b'=' * (-len(b64) % 4)))
        except Exception:
            continue
        if len(dec) == want:
            grids.append(list(struct.unpack('<%dI' % (want // 4), dec)))
    return grids

def door_sides(lnk, mw, mh):
    s = set()
    if any(lnk[x] for x in range(mw)): s.add('N')
    if any(lnk[(mh - 1) * mw + x] for x in range(mw)): s.add('S')
    if any(lnk[y * mw] for y in range(mh)): s.add('W')
    if any(lnk[y * mw + mw - 1] for y in range(mh)): s.add('E')
    return sorted(s)

def decode(path):
    tw, th, mw, mh, d = header_dims(path)
    grids = find_grids(d, mw, mh)
    col = grids[0] if len(grids) >= 1 else None
    lnk = grids[1] if len(grids) >= 2 else None
    return {'tile': [tw, th], 'map': [mw, mh], 'col': col, 'lnk': lnk,
            'doors': door_sides(lnk, mw, mh) if lnk else [], 'ngrids': len(grids)}

if __name__ == '__main__':
    base = r'G:\杂活\决明工作室\黑日计划\deadcells_pak\res_extracted\tiled\tmx'
    total = ok = bad = 0
    per_biome = collections.defaultdict(lambda: [0, 0, 0, 0])  # rooms, 1door, 2door, >=3door
    door_hist = collections.Counter()
    for bi in sorted(os.listdir(base)):
        bp = os.path.join(base, bi)
        if not os.path.isdir(bp): continue
        for f in sorted(os.listdir(bp)):
            if not f.endswith('.tmx'): continue
            total += 1
            try:
                m = decode(os.path.join(bp, f))
                ok += 1
                nd = len(m['doors'])
                door_hist[nd] += 1
                per_biome[bi][0] += 1
                if nd == 1: per_biome[bi][1] += 1
                elif nd == 2: per_biome[bi][2] += 1
                else: per_biome[bi][3] += 1
            except Exception as e:
                bad += 1
                print('FAIL', bi, f, e)
    print('rooms total=%d ok=%d bad=%d' % (total, ok, bad))
    print('door-count histogram:', dict(sorted(door_hist.items())))
    json.dump({bi: per_biome[bi] for bi in per_biome},
              open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'biome_stats.json'), 'w'))
