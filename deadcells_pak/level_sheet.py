#!/usr/bin/env python3
"""Dump `level` and `biome` sheets: the per-floor room-type plan (generation blueprint)."""
import json, os, collections

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

lvl = sheet('level')
print('level columns:', [c['name'] for c in lvl['columns']])
lrows = rows_of(lvl)
print('level rows:', len(lrows))
print('sample:', json.dumps(lrows[0], ensure_ascii=False)[:300] if lrows else None)
print()
for r in lrows:
    print(json.dumps(r, ensure_ascii=False))
