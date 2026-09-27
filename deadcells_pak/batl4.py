#!/usr/bin/env python3
"""Fit BATL frame record layout using PNG sheet dims as constraint."""
import os, struct, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

def png_dims(path):
    d = open(path, 'rb').read(24)
    if d[:8] != b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack_from('>II', d, 16)

# find a few atlases + sheets
cands = []
for r, _, fs in os.walk(ATL):
    for f in fs:
        if f.endswith('.atlas'):
            cands.append(os.path.join(r, f))
print('atlases:', len(cands))

def rstr(d, i):
    nl = d[i]; i += 1
    return d[i:i+nl].decode('utf-8', 'replace'), i + nl

for fp in cands[:6]:
    d = open(fp, 'rb').read()
    i = 4
    name, i = rstr(d, i)
    print('\n=== %s sheet=%s total=%d' % (os.path.basename(fp), name, len(d)))
    print('  first 60 bytes after name:', d[i:i+60].hex(' '))
    png = os.path.join(ATL, name)
    dims = png_dims(png)
    print('  png dims:', dims)
    # try strides 8..28 after each frame name, count valid records
    if dims:
        W, H = dims
        best = []
        for stride in range(8, 30):
            j = i
            cnt = 0; ok = True
            while j < len(d) and cnt < 200000:
                nl = d[j]
                if nl > 100: ok = False; break
                j += 1 + nl
                if j + stride > len(d): ok = False; break
                w, h, x, y = struct.unpack_from('<HHHH', d, j)
                if w > W or h > H or x > W or y > H: ok = False; break
                j += stride
                cnt += 1
            best.append((stride, cnt, ok, j))
        for s, c, ok, end in best:
            if ok:
                print('  stride=%d frames=%d end=%d/%d' % (s, c, end, len(d)))
