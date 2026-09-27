#!/usr/bin/env python3
"""Sprite naming convention + anims/ + atlas .json files."""
import os, struct, collections, io, sys, re, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')
RES = os.path.join(HERE, 'res_extracted')

def frame_names(path, limit=40):
    d = open(path, 'rb').read()
    i = 4
    nl = d[i]
    sheet = d[i+1:i+1+nl]
    names = []
    i += 1 + nl + 16
    while i < len(d) and len(names) < limit:
        nl2 = d[i]
        if nl2 < 1 or nl2 > 60: break
        cand = d[i+1:i+1+nl2]
        if not all(32 <= c < 127 for c in cand): break
        names.append(cand.decode('utf-8', 'replace'))
        # advance: 8 (whxy) + T trailing bytes; find T by locating next name
        # simpler: scan forward for next valid name after offset 8
        j = i + 1 + nl2 + 8
        # try T in 0..16: pick smallest T such that at j+T a valid name starts
        found = False
        for T in range(0, 17):
            k = j + T
            if k >= len(d): break
            nl3 = d[k]
            if 1 <= nl3 <= 60 and all(32 <= c < 127 for c in d[k+1:k+1+nl3]):
                i = k
                found = True
                break
        if not found:
            break
    return sheet.decode(), names

for a in ['zombie.atlas', 'common.atlas', 'prison.atlas' if os.path.exists(os.path.join(ATL,'prison.atlas')) else 'castle.atlas', 'ui.atlas', 'fxCommon.atlas']:
    p = os.path.join(ATL, a)
    if not os.path.exists(p): continue
    sheet, names = frame_names(p, 25)
    print('=== %s (sheet %s) first names:' % (a, sheet))
    for n in names[:25]:
        print('   ' + n)
    print()

# name pattern histogram across a few atlases
pat = collections.Counter()
for a in os.listdir(ATL):
    if not a.endswith('.atlas'): continue
    p = os.path.join(ATL, a)
    d = open(p, 'rb').read()
    i = 4
    try:
        nl = d[i]
        i += 1 + nl + 16
        cnt = 0
        while i < len(d) and cnt < 200:
            nl2 = d[i]
            if nl2 < 1 or nl2 > 60: break
            cand = d[i+1:i+1+nl2]
            if not all(32 <= c < 127 for c in cand): break
            nm = cand.decode()
            cnt += 1
            m = re.match(r'^(\d+x\d+)?/?(.*)$', nm)
            pat[(bool(m.group(1)), len(nm.split('/')[1].split('_')[0]) if '/' in nm else -1)] += 1
            j = i + 1 + nl2 + 8
            found = False
            for T in range(0, 17):
                k = j + T
                if k >= len(d): break
                nl3 = d[k]
                if 1 <= nl3 <= 60 and all(32 <= c < 127 for c in d[k+1:k+1+nl3]):
                    i = k; found = True; break
            if not found: break
    except Exception:
        pass

# 2. anims/
print('=== anims/ ===')
for f in sorted(os.listdir(os.path.join(RES, 'anims'))):
    fp = os.path.join(RES, 'anims', f)
    sz = os.path.getsize(fp)
    head = open(fp, 'rb').read(64)
    print('  %-24s %10d bytes  head=%r' % (f, sz, head[:20]))

# 3. atlas .json sample
print('\n=== atlas .json samples ===')
jcount = 0
for f in sorted(os.listdir(ATL)):
    if f.endswith('.json'):
        jcount += 1
        if jcount <= 5:
            fp = os.path.join(ATL, f)
            d = open(fp, 'r', encoding='utf-8', errors='replace').read()
            print('  %s (%d bytes): %s' % (f, len(d), d[:220].replace('\n', ' ')))
print('total atlas jsons:', jcount)
