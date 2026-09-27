#!/usr/bin/env python3
"""heaps .atlas binary parser: BATL magic. Parse all 292 atlases, stats."""
import os, struct, collections, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

def rstr(d, p):
    n = d[p]; p += 1
    if n == 0: return '', p
    return d[p:p+n].decode('utf-8', 'replace'), p + n

def parse_atlas(path):
    d = open(path, 'rb').read()
    if d[:4] != b'BATL':
        return None
    p = 4
    ver, p = struct.unpack_from('<I', d, p)  # version?
    # try: u32 version, then string name?
    # probe structure generically: record sequence of (len, str) and u32s
    # Actually known heaps .atlas (heaps.AssetsAtlas):
    # BATL + u32 version + ... frames: name(str) w u16 h u16 x u16 y u16 ...
    out = {'version': ver, 'frames': []}
    p = 4
    # version u32
    ver, p = struct.unpack_from('<I', d, p); p += 4
    out['version'] = ver
    # maybe atlas name str
    try:
        name, p = rstr(d, p)
        out['name'] = name
    except Exception:
        pass
    # now parse frames until EOF or failure:
    # heaps Sprite: u16 w, u16 h; u16 x, u16 y; u32? ...
    frames = []
    i = p
    while i < len(d) - 8:
        nl = d[i]
        if nl > 200: break
        i += 1
        if i + nl > len(d): break
        name = d[i:i+nl].decode('utf-8', 'replace'); i += nl
        try:
            w, h, x, y = struct.unpack_from('<HHHH', d, i)
        except Exception:
            break
        i += 8
        if w > 4096 or h > 4096 or x > 65535: break
        frames.append((name, w, h, x, y))
        # after x,y: likely more fields; guess stride. try common heaps Sprite fields:
        # sourceX u16 sourceY u16 sourceW u16 sourceH u16 ? -> 8 bytes
        i += 8
    out['frames'] = frames
    out['parsed_to'] = i
    return out

# first test on the sample, print hex head
f0 = os.path.join(ATL, 'achievements.atlas')
d = open(f0, 'rb').read()
print('hex head:', d[:64].hex(' '))
r = parse_atlas(f0)
print('version:', r['version'], 'name:', repr(r.get('name')), 'frames:', len(r['frames']))
for f in r['frames'][:8]:
    print('  ', f)
print('parsed_to:', r['parsed_to'], 'of', len(d))
