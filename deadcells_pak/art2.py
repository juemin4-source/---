#!/usr/bin/env python3
"""Full art asset inventory: atlas sheets, sprite naming, anims, other art dirs."""
import os, struct, collections, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, 'res_extracted')
ATL = os.path.join(RES, 'atlas')

def png_dims(path):
    d = open(path, 'rb').read(24)
    if d[:8] != b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack_from('>II', d, 16)

# 1. atlas/ is flat? list file types
ext = collections.Counter(); sz = collections.Counter()
for f in os.listdir(ATL):
    p = os.path.join(ATL, f)
    if os.path.isfile(p):
        e = os.path.splitext(f)[1].lower()
        ext[e] += 1; sz[e] += os.path.getsize(p)
print('=== atlas/ flat file types ===')
for e, c in ext.most_common():
    print('  %-8s %5d files %12d bytes' % (e, c, sz[e]))

# 2. .atlas names (categories)
atl_names = [f for f in os.listdir(ATL) if f.endswith('.atlas')]
print('\n=== .atlas categories (%d) ===' % len(atl_names))
for a in sorted(atl_names):
    print('  ' + a)

# 3. referenced PNG sheet sizes
print('\n=== sheet size histogram ===')
sheet_sz = collections.Counter()
sheet_names = []
for a in atl_names:
    d = open(os.path.join(ATL, a), 'rb').read()
    if d[:4] != b'BATL': continue
    nl = d[4]
    sheet = d[5:5+nl].decode('utf-8', 'replace')
    sp = os.path.join(ATL, sheet)
    dims = png_dims(sp) if os.path.exists(sp) else None
    if dims:
        sheet_sz[dims] += 1
        sheet_names.append((sheet, dims))
for dims, c in sorted(sheet_sz.items()):
    print('  %4dx%-4d : %3d sheets' % (dims[0], dims[1], c))
