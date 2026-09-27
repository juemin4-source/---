#!/usr/bin/env python3
"""Extract the per-floor room plan: level.specificSubBiome / level@props@specificSubBiome."""
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

# level table
lvl = rows_of(sheet('level'))
print('== level rows:', len(lvl))
print('level[0] keys:', list(lvl[0].keys()))
# Show id/name/biome/worldDepth/transitionTo and the specificSubBiome reference
for r in lvl[:12]:
    print('  %-22s %-24s biome=%-14s wD=%s tT=%s' % (
        str(r.get('id'))[:22], str(r.get('name'))[:24], str(r.get('biome'))[:14],
        r.get('worldDepth'), r.get('transitionTo')))

# the room-count plan
sub = sheet('level@props@specificSubBiome')
if sub:
    print('\n== level@props@specificSubBiome columns:', [c['name'] for c in sub['columns']])
    srows = rows_of(sub)
    print('rows:', len(srows))
    print(json.dumps(srows[0], ensure_ascii=False, indent=1)[:1500])
else:
    print('no level@props@specificSubBiome sheet')
