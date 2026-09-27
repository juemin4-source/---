#!/usr/bin/env python3
"""Robust Dead Cells BTMX grid + door extractor.
- header: 'BTMX' u8 fmtver str str  u16 tile_w u16 tile_h u16 map_w u16 map_h
- scan for base64 runs; each that zlib-decompresses to exactly map_w*map_h*4 bytes is a tile grid.
  first = col (collision), second = lnk (doors/linkable).
- lnk GIDs (tileset lnk, 8 tiles) mark door positions -> derive N/S/E/W door sides.
"""
import struct, zlib, base64, os, sys, re

def b64runs(d):
    runs = []
    i = 0
    pat = re.compile(rb'[A-Za-z0-9+/=]+')
    for m in pat.finditer(d):
        if len(m.group()) >= 40:
            runs.append((m.start(), m.group()))
    return runs

def decode_grids(path, mw, mh):
    d = open(path, 'rb').read()
    want = mw * mh * 4
    grids = []
    for off, b64 in b64runs(d):
        try:
            raw = base64.b64decode(b64 + b'=' * (-len(b64) % 4))
            dec = zlib.decompress(raw)
        except Exception:
            continue
        if len(dec) == want:
            grids.append(list(struct.unpack('<%dI' % (mw * mh), dec)))
    return grids

def read_dims(path):
    d = open(path, 'rb').read()
    # 'BTMX' + u8 + 2 strings
    p = 4 + 1
    # str1
    n = d[p]; p += 1 + n
    # str2
    n = d[p]; p += 1 + n
    tw, th, mw, mh = struct.unpack_from('<HHHH', d, p)
    return tw, th, mw, mh

def door_sides(grid, mw, mh, threshold=1):
    """For each border cell with a door GID>0, record which side it's on."""
    doors = {'N': 0, 'S': 0, 'E': 0, 'W': 0}
    cells = []
    for y in range(mh):
        for x in range(mw):
            v = grid[y * mw + x]
            if v >= threshold:
                cells.append((x, y, v))
    return cells

if __name__ == '__main__':
    base = r"G:\杂活\决明工作室\黑日计划\deadcells_pak\res_extracted\tiled\tmx"
    rooms = []
    for bi in sorted(os.listdir(base)):
        bp = os.path.join(base, bi)
        if not os.path.isdir(bp):
            continue
        for f in sorted(os.listdir(bp)):
            if f.endswith('.tmx'):
                rooms.append((bi, f, os.path.join(bp, f)))
    print('total rooms', len(rooms))
    # sample: decode first room of a few biomes and show door cells
    import collections
    sizes = collections.Counter()
    door_side_stats = collections.Counter()
    for bi, f, fp in rooms[:8]:
        tw, th, mw, mh = read_dims(fp)
        grids = decode_grids(fp, mw, mh)
        print('%s/%s  %dx%d  grids=%d' % (bi, f, mw, mh, len(grids)))
        if len(grids) >= 2:
            lnk = grids[1]
            cells = door_sides(lnk, mw, mh)
            print('   lnk door cells:', len(cells), cells[:8])
