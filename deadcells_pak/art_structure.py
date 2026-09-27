#!/usr/bin/env python3
"""Dead Cells art asset structure: file tree, formats, sizes, atlas layout."""
import os, collections, io, sys, struct
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, 'res_extracted')

# top-level tree
print('=== res_extracted top-level ===')
for e in sorted(os.listdir(RES)):
    p = os.path.join(RES, e)
    if os.path.isdir(p):
        n = 0; sz = 0
        for r, _, fs in os.walk(p):
            for f in fs:
                n += 1; sz += os.path.getsize(os.path.join(r, f))
        print('  DIR  %-18s %6d files %10d bytes' % (e, n, sz))
    else:
        print('  FILE %-18s %10d bytes' % (e, os.path.getsize(p)))

# extension histogram
exts = collections.Counter()
ext_sz = collections.Counter()
ext_cnt = collections.Counter()
for r, _, fs in os.walk(RES):
    for f in fs:
        e = os.path.splitext(f)[1].lower()
        exts[e] += 1
        ext_sz[e] += os.path.getsize(os.path.join(r, f))
print('\n=== extension histogram (count, total bytes) ===')
for e, c in exts.most_common(40):
    print('  %-10s %6d files %12d bytes' % (e, c, ext_sz[e]))
