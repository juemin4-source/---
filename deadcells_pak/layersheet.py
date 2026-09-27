#!/usr/bin/env python3
"""The `layer` sheet = biome room-type recipe. Join with biome + level."""
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

lay = sheet('layer')
print('== layer columns:', [c['name'] for c in lay['columns']])
lrows = rows_of(lay)
print('rows:', len(lrows))
print('sample:', json.dumps(lrows[0], ensure_ascii=False)[:300])
print()
# group by biome
from collections import defaultdict
by_biome = defaultdict(list)
for r in lrows:
    by_biome[r.get('biome') or r.get('id')].append(r)
print('biomes in layer sheet:', len(by_biome))
# show the PrisonStart biome recipe fully
for b in ['PrisonStart', 'PrisonCourtyard', 'SewerDepths']:
    if b in by_biome:
        print('\n--- %s recipe ---' % b)
        for r in by_biome[b]:
            print('  ', json.dumps(r, ensure_ascii=False)[:220])
json.dump({k: v for k, v in by_biome.items()},
          open(os.path.join(HERE, 'layer_recipe.json'), 'w'), indent=1, default=str)
print('\nwrote layer_recipe.json, biomes:', len(by_biome))
