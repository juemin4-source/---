#!/usr/bin/env python3
"""Dead Cells BTMX door extractor.
Dims = first (tw,th,mw,mh) u16-quad in header where tw==th (tile size) and 5<=mw,mh<=400.
Door object signature in 'markers' layer: <u8 tlen><type> FFFFFFFF f32 x f32 y f32 w f32 h.
Side = nearest room wall to object center.
"""
import struct, os, sys, collections

def header(path):
    d = open(path, 'rb').read()
    for off in range(8, 32):
        tw, th, mw, mh = struct.unpack_from('<HHHH', d, off)
        if tw == th and 8 <= mw <= 400 and 8 <= mh <= 400 and tw <= 128:
            return tw, th, mw, mh, d
    raise ValueError('dims not found')

def find_doors(path):
    tw, th, mw, mh, d = header(path)
    W, H = mw * tw, mh * th
    doors = []
    i = 0
    while True:
        i = d.find(b'\xff\xff\xff\xff', i)
        if i < 0: break
        for tlen in range(2, 21):
            if i - 1 - tlen < 0: continue
            if d[i - 1 - tlen] != tlen: continue
            tstr = d[i - tlen: i]
            if all(32 <= c < 127 for c in tstr):
                x, y, w, h = struct.unpack_from('<ffff', d, i + 4)
                cx, cy = x + w / 2, y + h / 2
                dW, dE, dN, dS = cx, W - cx, cy, H - cy
                m = min(dW, dE, dN, dS)
                side = 'W' if m == dW else 'E' if m == dE else 'N' if m == dN else 'S'
                doors.append({'type': tstr.decode(), 'x': x, 'y': y, 'side': side})
                break
        i += 4
    return tw, th, mw, mh, doors

if __name__ == '__main__':
    base = r'G:\杂活\决明工作室\黑日计划\deadcells_pak\res_extracted\tiled\tmx'
    for f in ['Prison/Pr1.tmx', 'Prison/Pr5.tmx', 'Common/Arena1.tmx']:
        fp = os.path.join(base, f)
        if not os.path.exists(fp):
            print('skip', f); continue
        tw, th, mw, mh, doors = find_doors(fp)
        print('== %s  map %dx%d (%dx%d px)  doors=%d' % (f, mw, mh, mw * tw, mh * th, len(doors)))
        for o in doors:
            print('  %-12s (%6.1f, %6.1f) -> %s' % (o['type'], o['x'], o['y'], o['side']))
