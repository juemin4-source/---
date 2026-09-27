#!/usr/bin/env python3
"""Fit frame layout: name + 4x u16(w,h,x,y) + T trailing, find T where parse covers the file."""
import os, struct, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

def png_dims(path):
    d = open(path, 'rb').read(24)
    if d[:8] != b'\x89PNG\r\n\x1a\n': return (0, 0)
    return struct.unpack_from('>II', d, 16)

def rstr(d, i):
    nl = d[i]
    return d[i+1:i+1+nl].decode('utf-8', 'replace'), i + 1 + nl

fp = os.path.join(ATL, 'achievements.atlas')
d = open(fp, 'rb').read()
i = 4
sheet, i = rstr(d, i)
W, H = png_dims(os.path.join(ATL, sheet))
print('sheet:', sheet, 'dims:', W, H, 'start i:', i)

# sheet header size: try 14,15,16 and see if first frame name follows
for shsz in (12, 13, 14, 15, 16, 17, 18):
    j = i + shsz
    if j >= len(d): continue
    nl = d[j]
    if nl < 2 or nl > 60: continue
    if not all(32 <= c < 127 for c in d[j+1:j+1+nl]): continue
    name = d[j+1:j+1+nl].decode()
    k = j + 1 + nl
    w, h, x, y = struct.unpack_from('<HHHH', d, k)
    if 1 <= w <= W and 1 <= h <= H and x < W and y < H:
        print('sheet_hdr=%d first frame name=%r whxy=%d,%d,%d,%d' % (shsz, name, w, h, x, y))
        # now fit trailing T
        for T in range(0, 24):
            p = k + 8 + T
            cnt = 0; ok = True
            while p < len(d) and cnt < 50000:
                if p >= len(d): break
                nl2 = d[p]
                if nl2 < 1 or nl2 > 60: ok = False; break
                if not all(32 <= c < 127 for c in d[p+1:p+1+nl2]): ok = False; break
                q = p + 1 + nl2
                if q + 8 + T > len(d): ok = False; break
                w2, h2, x2, y2 = struct.unpack_from('<HHHH', d, q)
                if not (1 <= w2 <= W and 1 <= h2 <= H and x2 < W and y2 < H): ok = False; break
                p = q + 8 + T
                cnt += 1
            if ok and cnt > 5:
                print('  T=%d -> frames=%d end=%d/%d %s' % (T, cnt, p, len(d), 'CLEAN-END' if p == len(d) else ''))
