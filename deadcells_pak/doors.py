#!/usr/bin/env python3
"""Definitive Dead Cells room door extractor.
Door = marker object record: <u8 tlen><type> FFFFFFFF f32 x f32 y f32 w f32 h.
Wall-face classification by door center vs room bands:
  N: y < 0.35H and mid-x ;  S: y > 0.65H and mid-x
  W: x < 0.35W and mid-y ;  E: x > 0.65W and mid-y
  Corners (diagonal): both coords extreme -> NE/NW/SE/SW
"""
import struct, os, re, json, collections

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, 'res_extracted/tiled/tmx')

def rstr(d, p):
    n = d[p]; p += 1
    return d[p:p+n].decode('utf-8', 'replace'), p + n

def header(path):
    d = open(path, 'rb').read()
    for off in range(8, 32):
        tw, th, mw, mh = struct.unpack_from('<HHHH', d, off)
        if tw == th and 4 <= mw <= 512 and 4 <= mh <= 512 and tw <= 128:
            return tw, th, mw, mh, d
    raise ValueError('dims not found')

def extract_doors(path):
    tw, th, mw, mh, d = header(path)
    W, H = mw * tw, mh * th
    doors = []
    i = 0
    while True:
        i = d.find(b'\xff\xff\xff\xff', i)
        if i < 0:
            break
        for tlen in range(2, 24):
            if i - 1 - tlen < 0:
                continue
            if d[i - 1 - tlen] != tlen:
                continue
            tstr = d[i - tlen:i]
            if all(32 <= c < 127 for c in tstr):
                x, y, w, h = struct.unpack_from('<ffff', d, i + 4)
                cx, cy = x + w / 2, y + h / 2
                doors.append({'type': tstr.decode(), 'x': x, 'y': y, 'cx': cx, 'cy': cy})
                break
        i += 4
    out = []
    for o in doors:
        o['side'] = wall_side(o, W, H)
        out.append(o)
    return tw, th, mw, mh, out

def wall_side(o, W, H):
    cx, cy = o['cx'], o['cy']
    nx, ny = cx / W, cy / H
    xN = ny < 0.4
    xS = ny > 0.6
    xW = nx < 0.4
    xE = nx > 0.6
    if xN and xW: return 'NW'
    if xN and xE: return 'NE'
    if xS and xW: return 'SW'
    if xS and xE: return 'SE'
    if xN: return 'N'
    if xS: return 'S'
    if xW: return 'W'
    if xE: return 'E'
    return '?'

def is_door_type(t):
    return 'Door' in t or t in ('ZDoor',)

def classify(sides):
    s = set(sides)
    if not s: return 'isolated'
    if len(s) == 1: return 'deadend'
    if len(s) == 2: return 'two'
    if len(s) == 3: return 'three'
    return 'four'

def main():
    rows = []
    for bi in sorted(os.listdir(BASE)):
        bp = os.path.join(BASE, bi)
        if not os.path.isdir(bp):
            continue
        for f in sorted(os.listdir(bp)):
            if not f.endswith('.tmx'):
                continue
            fp = os.path.join(bp, f)
            try:
                tw, th, mw, mh, doors = extract_doors(fp)
                ddoors = [o for o in doors if is_door_type(o['type'])]
                sides = sorted({o['side'] for o in ddoors})
                rows.append({'biome': bi, 'file': f, 'w': mw, 'h': mh,
                             'area': mw * mh, 'doors': sides, 'nd': len(sides),
                             'nobjs': len(doors), 'type': classify(sides)})
            except Exception as e:
                rows.append({'biome': bi, 'file': f, 'err': str(e)})
    ok = [r for r in rows if 'err' not in r]
    err = [r for r in rows if 'err' in r]
    print('rooms %d ok %d err %d' % (len(rows), len(ok), len(err)))
    for e in err[:8]:
        print('  ERR', e['biome'], e['file'], e['err'])
    th = collections.Counter(r['nd'] for r in ok)
    print('door-count histogram:', dict(sorted(th.items())))
    # per biome
    per = collections.defaultdict(lambda: {'n': 0, 'area': 0, 'nd': 0, 'types': collections.Counter()})
    for r in ok:
        b = per[r['biome']]
        b['n'] += 1; b['area'] += r['area']; b['nd'] += r['nd']
        b['types'][r['type']] += 1
    json.dump({'rows': rows,
               'door_hist': dict(th),
               'biomes': {k: {'n': v['n'], 'avg_area': round(v['area'] / v['n'], 1),
                              'avg_doors': round(v['nd'] / v['n'], 2),
                              'types': dict(v['types'])} for k, v in per.items()}},
              open(os.path.join(HERE, 'doors.json'), 'w'), indent=1)
    print('door side frequency:')
    sf = collections.Counter()
    for r in ok:
        for s in r['doors']:
            sf[s] += 1
    print('  ', dict(sf))
    return rows

if __name__ == '__main__':
    main()
