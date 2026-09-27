#!/usr/bin/env python3
"""FINAL Dead Cells map-design reverse-engineering dataset.
Doorways = contiguous open runs on a room border (col layer) that are bounded by solid
cells and have an open cell just inside. 5-wide => one door frame.
Also decode door-marker objects for door TYPE (normal / triggered / oneway).
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
    for off in range(8, 28):
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
            out.append(struct.unpack('<%dI' % (want // 4), dec))
    return out

def door_objects(d):
    """Return door-marker types + their wall side (for door-type classification)."""
    res = []
    i = 0
    while True:
        i = d.find(b'\xff\xff\xff\xff', i)
        if i < 0: break
        for tlen in range(2, 24):
            if i - 1 - tlen < 0: continue
            if d[i - 1 - tlen] != tlen: continue
            tstr = d[i - tlen:i]
            if all(32 <= c < 127 for c in tstr):
                res.append(tstr.decode())
                break
        i += 4
    return res

def border_doorways(col, mw, mh):
    sides = {}
    def gap_runs(vals, inside):
        runs = []
        i = 0; n = len(vals)
        while i < n:
            if vals[i] == 0:
                j = i
                while j < n and vals[j] == 0: j += 1
                bounded = (i == 0 or vals[i-1] != 0) and (j == n or vals[j] != 0)
                inside_open = any(inside[k] == 0 for k in range(i, j))
                if bounded and inside_open:
                    runs.append((i, j, j - i))
                i = j
            else:
                i += 1
        return runs
    top = list(col[0:mw]); bot = list(col[(mh-1)*mw:mh*mw])
    topin = list(col[mw:2*mw]); botin = list(col[(mh-2)*mw:(mh-1)*mw])
    lef = [col[y*mw] for y in range(mh)]; rig = [col[y*mw+mw-1] for y in range(mh)]
    lefin = [col[y*mw+1] for y in range(mh)]; rigin = [col[y*mw+mw-2] for y in range(mh)]
    sides['N'] = gap_runs(top, topin)
    sides['S'] = gap_runs(bot, botin)
    sides['W'] = gap_runs(lef, lefin)
    sides['E'] = gap_runs(rig, rigin)
    return sides

def topology(sides):
    active = [s for s in 'NSEW' if sides.get(s)]
    n = len(active)
    if n == 0: return 'isolated'
    if n == 1: return 'deadend'
    if n == 2:
        if {'N','S'} <= set(active) or {'W','E'} <= set(active): return 'corridor'
        return 'corner'
    if n == 3: return 'junction'
    return 'cross'

def main():
    rows = []
    for bi in sorted(os.listdir(BASE)):
        bp = os.path.join(BASE, bi)
        if not os.path.isdir(bp): continue
        for f in sorted(os.listdir(bp)):
            if not f.endswith('.tmx'): continue
            fp = os.path.join(bp, f)
            try:
                tw, th, mw, mh, d = header(fp)
                gs = grids(fp, mw, mh)
                if not gs:
                    rows.append({'biome': bi, 'file': f, 'err': 'no grid'}); continue
                col = gs[0]
                sides = border_doorways(col, mw, mh)
                dobj = door_objects(d)
                has_triggered = any('Triggered' in t for t in dobj)
                has_oneway = any('OneWay' in t for t in dobj)
                rows.append({'biome': bi, 'file': f, 'w': mw, 'h': mh, 'area': mw*mh,
                             'doorways': {s: len(v) for s, v in sides.items()},
                             'n_sides': sum(1 for s in 'NSEW' if sides[s]),
                             'type': topology(sides),
                             'triggered': has_triggered, 'oneway': has_oneway,
                             'n_objects': len(dobj)})
            except Exception as e:
                rows.append({'biome': bi, 'file': f, 'err': str(e)})
    ok = [r for r in rows if 'err' not in r]
    print('rooms %d ok %d err %d' % (len(rows), len(ok), len(rows)-len(ok)))
    # aggregates
    hist_type = collections.Counter(r['type'] for r in ok)
    hist_sides = collections.Counter(r['n_sides'] for r in ok)
    area_buckets = collections.Counter()
    for r in ok:
        a = r['area']
        b = 100 if a < 1000 else (500 if a < 2000 else 1000)
        area_buckets[int(a // b) * b] += 1
    # per biome
    per = collections.defaultdict(lambda: {'n':0,'area':0,'types':collections.Counter(),'triggered':0})
    for r in ok:
        b = per[r['biome']]
        b['n'] += 1; b['area'] += r['area']
        b['types'][r['type']] += 1
        if r['triggered']: b['triggered'] += 1
    biomes_out = {}
    for k, v in sorted(per.items()):
        biomes_out[k] = {'rooms': v['n'], 'avg_area': round(v['area']/v['n'],1),
                         'types': dict(v['types']), 'triggered_doors': v['triggered']}
    out = {'total_rooms': len(ok), 'type_hist': dict(hist_type), 'side_hist': dict(hist_sides),
           'area_hist': {str(k): v for k, v in sorted(area_buckets.items())},
           'biomes': biomes_out}
    json.dump(out, open(os.path.join(HERE, 'map_design.json'), 'w'), indent=1)
    json.dump(ok, open(os.path.join(HERE, 'rooms.json'), 'w'), indent=0)
    print('type histogram:', dict(hist_type))
    print('door-side histogram:', dict(sorted(hist_sides.items())))
    print('area histogram:', {str(k): v for k, v in sorted(area_buckets.items())})
    # room-size range
    areas = sorted(r['area'] for r in ok)
    print('area min/med/max:', areas[0], areas[len(areas)//2], areas[-1])
    print('biomes:', len(biomes_out))

if __name__ == '__main__':
    main()
