#!/usr/bin/env python3
"""Per-biome room-type recipe (biome@layers) + per-floor specificSubBiome weights."""
import json, os, collections, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, 'res_extracted/data.cdb'), encoding='utf-8'))

def sheet(name):
    for s in d['sheets']:
        if s.get('name') == name:
            return s
    return None

def rows_of(s):
    out = []
    for ln in s.get('lines', []):
        if isinstance(ln, dict):
            out.append(ln)
        elif isinstance(ln, (list, tuple)):
            out.append(dict(zip([c['name'] for c in s['columns']], ln)))
    return out

# biome@layers : the room-type pool + counts per biome
bl = sheet('biome@layers')
print('== biome@layers columns:', [c['name'] for c in bl['columns']])
brows = rows_of(bl)
print('rows:', len(brows))
print('sample:', json.dumps(brows[0], ensure_ascii=False)[:400])
print()
# print a few biomes' full layer recipe
for r in brows[:3]:
    print(json.dumps(r, ensure_ascii=False))
    print()

# level.specificSubBiome weights
lvl = rows_of(sheet('level'))
print('== floor room-count plans (specificSubBiome) ==')
for r in lvl[:14]:
    ssb = r.get('specificSubBiome')
    if ssb:
        print('%-18s wD=%s  %s' % (r.get('id'), r.get('worldDepth'), json.dumps(ssb, ensure_ascii=False)[:200]))
