#!/usr/bin/env python3
"""atlas/ internal structure + .atlas format + sprite naming."""
import os, collections, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

print('=== atlas/ subdirs (count, bytes) ===')
sub = []
for e in sorted(os.listdir(ATL)):
    p = os.path.join(ATL, e)
    if os.path.isdir(p):
        n = 0; sz = 0
        for r, _, fs in os.walk(p):
            for f in fs:
                n += 1; sz += os.path.getsize(os.path.join(r, f))
        sub.append((n, sz, e))
for n, sz, e in sorted(sub, key=lambda t: -t[1])[:45]:
    print('  %-28s %6d files %10d bytes' % (e, n, sz))

# .atlas file format: read one
af = os.path.join(ATL, 'common/atlas_common.atlas') if os.path.exists(os.path.join(ATL,'common')) else None
atlas_files = []
for r, _, fs in os.walk(ATL):
    for f in fs:
        if f.endswith('.atlas'):
            atlas_files.append(os.path.join(r, f))
print('\n.atlas files:', len(atlas_files))
sample = atlas_files[0]
d = open(sample, 'r', encoding='utf-8', errors='replace').read()
print('sample:', sample, '(%d bytes)' % len(d))
print('--- first 40 lines ---')
for ln in d.splitlines()[:40]:
    print(' ', ln)
print('--- frame count ---')
frames = re.findall(r'^\s*(\S+)\s*$', d, re.M)
print('keys:', len(frames))
