#!/usr/bin/env python3
"""Join data.cdb `room` sheet (room type/flags) with decoded .tmx room geometry.
Also dump `level` sheet (per-floor room-type plan) and `biome@layers`."""
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

room_s = sheet('room')
room_rows = rows_of(room_s)
print('room sheet rows:', len(room_rows))
print('room columns:', [c['name'] for c in room_s['columns']])
# type distribution
type_dist = collections.Counter(r.get('type', '?') for r in room_rows)
print('\nROOM TYPE distribution (from data.cdb):')
for t, c in type_dist.most_common():
    print('  %-22s %4d' % (t, c))
# group distribution
grp = collections.Counter(r.get('group', 0) for r in room_rows)
print('\ngroups:', dict(sorted(grp.items())[:30]))

# join with tmx geometry
rooms_geo = json.load(open(os.path.join(HERE, 'rooms.json')))
geo_by_name = {os.path.splitext(r['file'])[0]: r for r in rooms_geo if 'err' not in r}
matched = unmatched = 0
combo = collections.Counter()
for r in room_rows:
    rid = r.get('id')
    g = geo_by_name.get(rid)
    if g:
        matched += 1
        combo[(r.get('type', '?'), g['type'])] += 1
    else:
        unmatched += 1
print('\nmatched room->geometry: %d, unmatched(cdb-only): %d' % (matched, unmatched))

# type x topology sanity (first 30)
print('\ntype x topology (top 30):')
for (t, top), c in sorted(combo.items(), key=lambda kv: -kv[1])[:30]:
    print('  %-20s %-10s %4d' % (t, top, c))

# save joined table
joined = []
for r in room_rows:
    rid = r.get('id')
    g = geo_by_name.get(rid, {})
    joined.append({'id': rid, 'type': r.get('type'), 'flags': r.get('flags'),
                   'group': r.get('group'), 'w': g.get('w'), 'h': g.get('h'),
                   'area': g.get('area'), 'topology': g.get('type'),
                   'door_sides': g.get('n_sides')})
json.dump(joined, open(os.path.join(HERE, 'rooms_joined.json'), 'w'), indent=0)
print('\nwrote rooms_joined.json')
