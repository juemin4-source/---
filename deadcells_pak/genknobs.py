#!/usr/bin/env python3
"""Extract per-level generation knobs (room pacing, density, cell ratios)."""
import json, os, io, sys, collections
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

lvl = rows_of(sheet('level'))
print('per-level generation knobs (sample of 16 floors):')
cols = ['id', 'worldDepth', 'minCombatRoomsBefore', 'maxCombatRoomsBefore',
        'mobDensity', 'cellRatioCount', 'eliteRoomChance', 'eliteWanderChance',
        'minGold', 'baseLootLevel', 'mobs', 'tripleUps', 'doubleUps']
present = set()
for r in lvl[:16]:
    line = []
    for c in cols:
        if c in r:
            present.add(c) if c not in present else None
            line.append('%s=%s' % (c, json.dumps(r[c], ensure_ascii=False)[:28]))
    print('  %-18s %s' % (str(r.get('id'))[:18], '  '.join(line)))

# which levels define room-pacing keys
print('\nlevels defining min/maxCombatRoomsBefore:')
for r in lvl:
    if 'minCombatRoomsBefore' in r or 'maxCombatRoomsBefore' in r:
        print('  %-18s min=%s max=%s mobDensity=%s cellRatioCount=%s' % (
            r.get('id'), r.get('minCombatRoomsBefore'), r.get('maxCombatRoomsBefore'),
            r.get('mobDensity'), r.get('cellRatioCount')))
