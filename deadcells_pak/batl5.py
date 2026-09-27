#!/usr/bin/env python3
"""Parse BATL: frame rec = name + w,h,x,y (4 x u16) + 8 trailing bytes (stride 18).
Self-validating: next byte must be a plausible name length + ASCII."""
import os, struct, collections, io, sys, json
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

def is_plausible(d, j):
    if j >= len(d): return False
    nl = d[j]
    if nl < 1 or nl > 60: return False
    if j + 1 + nl + 9 > len(d): return False
    return all(32 <= c < 127 for c in d[j+1:j+1+nl])

frames_by_group = collections.Counter()
atlas_rows = []
for r, _, fs in os.walk(ATL):
    for f in fs:
        if not f.endswith('.atlas'): continue
        fp = os.path.join(r, f)
        d = open(fp, 'rb').read()
        if d[:4] != b'BATL': continue
        i = 4
        try:
            sheet, i = rstr(d, i)
        except Exception:
            continue
        i += 16  # sheet payload (dims 2 u16 + 12 more)
        W, H = png_dims(os.path.join(ATL, sheet))
        frames = 0; i2 = i; names = []
        while i2 < len(d) and is_plausible(d, i2):
            name, j = rstr(d, i2)
            w, h, x, y = struct.unpack_from('<HHHH', d, j)
            j += 8
            if not (w <= W and h <= H and x < W and y < H and w > 0 and h > 0):
                break
            if not is_plausible(d, j + 8):
                break
            frames += 1
            names.append(name)
            i2 = j + 8
        grp = os.path.dirname(os.path.relpath(fp, ATL).replace('\\', '/')).split('/')[0]
        if grp == '.': grp = 'root'
        frames_by_group[grp] += frames
        atlas_rows.append({'file': os.path.relpath(fp, ATL).replace('\\', '/'),
                           'sheet': sheet, 'sheet_dims': [W, H], 'frames': frames,
                           'name_sample': names[:3]})

print('atlases:', len(atlas_rows), 'total frames:', sum(frames_by_group.values()))
print('\nsprite frames by atlas group (all 292 atlases):')
for g, c in frames_by_group.most_common():
    print('  %-26s %7d' % (g, c))
json.dump(atlas_rows, open(os.path.join(HERE, 'atlas_info.json'), 'w'), indent=0)
print('\nwrote atlas_info.json')
