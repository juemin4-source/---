#!/usr/bin/env python3
"""Dead Cells BTMX (binary Tiled) decoder - reverse engineered.
Header: 'BTMX', u8 fmtver, str tiled_ver, str tiled_build,
        u32 tile_w, u32 tile_h, u32 map_w, u32 map_h, u32 layer_count
Per layer: u32 total_len (covers u32 + rest), u32 payload_len, payload
  Tile layer payload  : base64(zlib) of u32 GID grid (w*h, row-major)  [b64_len == payload_len]
  Object layer payload: u32 obj_count, then objects:
      u16 id, u32 ?, name, u16 prop_count, [key,val]*, u8 tlen, type, u32(-1), f32 x y w h, 7B zero
Layer order: col (collision), lnk (linkable/door), [extra tiles], markers (objects)
Tail: u16 tileset_count, per ts: name, u16 firstgid, source
"""
import struct, zlib, base64, os, sys

def rstr(d, p):
    n = d[p]; p += 1
    return d[p:p+n].decode('utf-8', 'replace'), p + n

def b64run(d, p):
    i = p
    while i < len(d) and (d[i:i+1].isalnum() or d[i:i+1] in (b'/', b'+', b'=')):
        i += 1
    return i - p

def decode(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'BTMX', path
    p = 4
    p += 1
    _, p = rstr(d, p)
    _, p = rstr(d, p)
    tw, th, mw, mh, lc = struct.unpack_from('<IIIII', d, p); p += 20
    tiles = {}   # index -> grid
    objs = []
    for li in range(lc):
        (total,) = struct.unpack_from('<I', d, p); p += 4
        block_end = p + total - 4
        (plen,) = struct.unpack_from('<I', d, p); p += 4
        runlen = b64run(d, p)
        if runlen >= plen and runlen == plen:
            # tile layer: b64 of length plen
            b64 = d[p:p+plen]
            raw = base64.b64decode(b64 + b'=' * (-len(b64) % 4))
            dec = zlib.decompress(raw)
            n = len(dec) // 4
            assert n == mw * mh, (n, mw * mh)
            tiles[li] = list(struct.unpack('<%dI' % n, dec))
        else:
            (cnt,) = struct.unpack_from('<I', d, p)
            p2 = p + 4
            for i in range(cnt):
                p2 += 2
                (oid,) = struct.unpack_from('<I', d, p2); p2 += 4
                nm, p2 = rstr(d, p2)
                (pc,) = struct.unpack_from('<H', d, p2); p2 += 2
                props = {}
                for _ in range(pc):
                    k, p2 = rstr(d, p2); v, p2 = rstr(d, p2); props[k] = v
                tl = d[p2]; p2 += 1
                typ = d[p2:p2+tl].decode('utf-8', 'replace'); p2 += tl
                p2 += 4
                x, y, w, h = struct.unpack_from('<ffff', d, p2); p2 += 16
                p2 += 7
                objs.append({'id': oid, 'name': nm, 'type': typ, 'x': x, 'y': y, 'w': w, 'h': h, 'props': props})
        p = block_end
    return {'path': path, 'tile': [tw, th], 'map': [mw, mh], 'tiles': tiles, 'objects': objs, 'end': p}

def render(m, layer):
    mw, mh = m['map']
    g = m['tiles'].get(layer)
    if not g:
        return ['(layer %d missing)' % layer]
    out = []
    for y in range(mh):
        row = []
        for x in range(mw):
            v = g[y*mw + x]
            row.append('.' if v == 0 else '%x' % min(v, 15))
        out.append(''.join(row))
    return out

if __name__ == '__main__':
    m = decode(sys.argv[1])
    print('map %dx%d tile %dx%d layers %d end %d size %d' % (m['map'][0], m['map'][1], m['tile'][0], m['tile'][1], len(m['tiles'])+ (1 if m['objects'] else 0), m['end'], os.path.getsize(m['path'])))
    for li in sorted(m['tiles']):
        print('=== tile layer %d ===' % li)
        for line in render(m, li):
            print(line)
    print('=== objects ===')
    for o in m['objects']:
        print('%s id=%d (%.0f,%.0f)%s' % (o['type'], o['id'], o['x'], o['y'], o['props']))
