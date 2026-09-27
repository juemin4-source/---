#!/usr/bin/env python3
"""Final BATL parse: frame = u8len+name + 9x u16 [unk,x,y,w,h,unk,unk,srcW,srcH].
Full inventory: frames per atlas group, _n variant overlap check."""
import os, struct, collections, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

def rstr(d, i):
    nl = d[i]
    return d[i+1:i+1+nl].decode('utf-8', 'replace'), i + 1 + nl

def parse(fp):
    d = open(fp, 'rb').read()
    if d[:4] != b'BATL': return None
    i = 4
    sheet, i = rstr(d, i)
    frames = []
    names = []
    while i < len(d) - 18:
        nl = d[i]
        if not (1 <= nl <= 80): break
        cand = d[i+1:i+1+nl]
        if not all(32 <= c < 127 for c in cand): break
        q = i + 1 + nl
        u = struct.unpack_from('<9H', d, q)
        unk, x, y, w, h, u6, u7, sw, sh = u
        if not (1 <= w <= 4096 and 1 <= h <= 4096): break
        names.append(cand.decode())
        frames.append((cand.decode(), x, y, w, h))
        i = q + 18
    return {'sheet': sheet, 'frames': len(frames), 'names': names, 'data': frames}

rows = []
for f in sorted(os.listdir(ATL)):
    if not f.endswith('.atlas'): continue
    r = parse(os.path.join(ATL, f))
    if r:
        rows.append((f, r['sheet'], r['frames'], r['names']))
tot = sum(x[2] for x in rows)
print('atlases parsed:', len(rows), 'total sprite frames:', tot)

# category by prefix
cat = collections.Counter()
for f, sheet, n, names in rows:
    base = f[:-6]
    if base.startswith('beheaded'): c = 'beheaded(主角头/皮肤)'
    elif base.startswith('fx'): c = 'fx(特效)'
    elif base.startswith('common'): c = 'common(通用道具)'
    elif any(k in base for k in ('atlas',)): c = 'other'
    else: c = 'other'
    cat[c] += n
for k, v in cat.most_common():
    print('  %-24s %8d frames' % (k, v))

# _n variant overlap
print('\n_n variant check (same sprite set, recolored sheet):')
for base in ['swamp', 'lighthouse', 'castle', 'prison']:
    a = base + '.atlas'
    b = base + '_n.atlas'
    if a in [x[0] for x in rows] and b in [x[0] for x in rows]:
        na = set(dict(rows)[a])
        nb = set(dict(rows)[b])
        print('  %-14s base=%4d frames  _n=%4d frames  name overlap=%d' % (
            base, len(na), len(nb), len(na & nb)))

# sample naming convention
print('\nnaming samples from a big env atlas:')
for f, sheet, n, names in rows:
    if f == 'swamp.atlas':
        print('  ', names[:14])
        break
for f, sheet, n, names in rows:
    if f == 'zombie.atlas':
        print('  zombie:', names[:14])
        break

# frame name prefix stats (animation verbs)
verbs = collections.Counter()
for f, sheet, n, names in rows:
    for nm in names:
        stem = nm.split('/')[-1]
        parts = stem.split('_')
        verbs[parts[0]] += 1
print('\nframe-name first token (animation verbs, top 25):')
for t, c in verbs.most_common(25):
    print('  %-20s %8d' % (t, c))

json.dump({f: {'sheet': s, 'frames': n, 'names': nm} for f, s, n, nm in rows},
          open(os.path.join(HERE, 'atlas_inventory.json'), 'w'))
print('\nwrote atlas_inventory.json')
