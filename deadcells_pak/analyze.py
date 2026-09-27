#!/usr/bin/env python3
"""Master Dead Cells room-map analysis.
For every .tmx room: read dims, decode col (collision) + lnk (door) grids,
detect door sides from col border gaps, classify topology, aggregate per biome + globally.
"""
import struct, zlib, base64, os, re, json, collections

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, 'res_extracted/tiled/tmx')
B64 = re.compile(rb'[A-Za-z0-9+/=]{40,}')

def rstr(d, p):
    n = d[p]; p += 1
    return d[p:p+n].decode('utf-8', 'replace'), p + n

def header(path):
    d = open(path, 'rb').read()
    for off in range(8, 32):
        tw, th, mw, mh = struct.unpack_from('<HHHH', d, off)
        if tw == th and 4 <= mw <= 512 and 4 <= mh <= 512 and tw <= 128:
            return tw, th, mw, mh, d
    raise ValueError('dims')

def grids(path, mw, mh):
    d = open(path, 'rb').read()
    want = mw * mh * 4
    out = []
    for m in B64.finditer(d):
        b64 = m.group()
        try:
            dec = zlib.decompress(base64.b64decode(b64 + b'=' * (-len(b64) % 4)))
        except Exception:
            continue
        if len(dec) == want:
            out.append(list(struct.unpack('<%dI' % (want // 4), dec)))
    return out

def edge_gaps(g, mw, mh):
    """Contiguous runs of walkable (GID 0) cells on each border => door runs."""
    def runs(vals):
        r = []
        i = 0
        while i < len(vals):
            if vals[i] == 0:
                j = i
                while j < len(vals) and vals[j] == 0:
                    j += 1
                if j - i >= 1:
                    r.append((i, j - 1, j - i))
                i = j
            else:
                i += 1
        return r
    sides = {}
    top = [g[x] for x in range(mw)]
    bot = [g[(mh - 1) * mw + x] for x in range(mw)]
    lef = [g[y * mw] for y in range(mh)]
    rig = [g[y * mw + mw - 1] for y in range(mh)]
    # A border gap only counts as a door if the interior behind it is open
    # (i.e. not an isolated 1-cell pocket against the outer void).
    sides['N'] = runs(top)
    sides['S'] = runs(bot)
    sides['W'] = runs(lef)
    sides['E'] = runs(rig)
    return sides

def door_sides(g, mw, mh):
    """A side has a door if its border has a gap AND the row/col just inside is open
    (the gap leads into the room)."""
    s = set()
    if mw < 3 or mh < 3:
        return s
    # N: any x where top is open and (x,1) is open
    if any(g[x] == 0 and g[mw + x] == 0 for x in range(mw)):
        s.add('N')
    if any(g[(mh - 1) * mw + x] == 0 and g[(mh - 2) * mw + x] == 0 for x in range(mw)):
        s.add('S')
    if any(g[y * mw] == 0 and g[y * mw + 1] == 0 for y in range(mh)):
        s.add('W')
    if any(g[y * mw + mw - 1] == 0 and g[y * mw + mw - 2] == 0 for y in range(mh)):
        s.add('E')
    return s

def classify(sides):
    s = set(sides)
    if len(s) == 0:
        return 'isolated'
    if len(s) == 1:
        return 'deadend'
    if len(s) == 2:
        if {'N', 'S'} <= s or {'W', 'E'} <= s:
            return 'corridor'
        return 'corner'
    if len(s) == 3:
        return 'junction'
    return 'cross'

def main():
    rooms = []
    for bi in sorted(os.listdir(BASE)):
        bp = os.path.join(BASE, bi)
        if not os.path.isdir(bp):
            continue
        for f in sorted(os.listdir(bp)):
            if not f.endswith('.tmx'):
                continue
            fp = os.path.join(bp, f)
            try:
                tw, th, mw, mh, _ = header(fp)
                gs = grids(fp, mw, mh)
                col = gs[0] if len(gs) >= 1 else None
                sides = sorted(door_sides(col, mw, mh)) if col else []
                areas = mw * mh
                rooms.append({'biome': bi, 'file': f, 'w': mw, 'h': mh,
                              'area': areas, 'doors': sides,
                              'type': classify(sides)})
            except Exception as e:
                rooms.append({'biome': bi, 'file': f, 'err': str(e)})
    ok = [r for r in rooms if 'err' not in r]
    print('rooms', len(rooms), 'ok', len(ok), 'err', len(rooms) - len(ok))
    # global stats
    type_hist = collections.Counter(r['type'] for r in ok)
    door_hist = collections.Counter(len(r['doors']) for r in ok)
    area_hist = collections.Counter()
    for r in ok:
        area_hist[round(r['area'] / 100) * 100] += 1
    # biome aggregation
    per_biome = {}
    for r in ok:
        b = r['biome']
        d = per_biome.setdefault(b, {'rooms': 0, 'avg_area': 0, 'types': collections.Counter()})
        d['rooms'] += 1
        d['avg_area'] += r['area']
        d['types'][r['type']] += 1
    for b in per_biome:
        per_biome[b]['avg_area'] = round(per_biome[b]['avg_area'] / per_biome[b]['rooms'], 1)
        per_biome[b]['types'] = dict(per_biome[b]['types'])
    json.dump({'rooms': rooms, 'biomes': per_biome,
               'type_hist': dict(type_hist), 'door_hist': dict(door_hist),
               'area_hist': dict(sorted(area_hist.items()))},
              open(os.path.join(HERE, 'room_analysis.json'), 'w'), indent=1)
    print('type_hist', dict(type_hist))
    print('door_hist', dict(sorted(door_hist.items())))
    print('biomes', len(per_biome))
    top = sorted(per_biome.items(), key=lambda kv: -kv[1]['rooms'])[:15]
    for b, d in top:
        print('  %-22s rooms=%-4d avg_area=%s' % (b, d['rooms'], d['avg_area']))

if __name__ == '__main__':
    main()
