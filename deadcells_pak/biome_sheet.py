#!/usr/bin/env python3
"""biome sheet + level.specificSubBiome (the actual per-floor room-type recipe)."""
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

bio = sheet('biome')
print('== biome columns:', [c['name'] for c in bio['columns']])
brows = rows_of(bio)
print('biomes:', len(brows))
print('sample keys:', list(brows[0].keys()))
print(json.dumps(brows[0], ensure_ascii=False)[:500])
print()
lvl = rows_of(sheet('level'))
print('== level.specificSubBiome sample (PrisonStart) ==')
for r in lvl:
    if r.get('id') in ('PrisonStart', 'PrisonCourtyard'):
        print(r.get('id'), '->', json.dumps(r.get('specificSubBiome'), ensure_ascii=False)[:600])
        print()
# how many floors have specificSubBiome
have = sum(1 for r in lvl if r.get('specificSubBiome'))
print('floors with specificSubBiome:', have, '/', len(lvl))
