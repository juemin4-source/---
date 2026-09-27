#!/usr/bin/env python3
"""Parse all BATL atlases with fixed stride (name + 8 u16 fields), aggregate sprite stats."""
import os, struct, collections, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

def rstr(d, i):
    nl = d[i]; i += 1
    return d[i:i+nl].decode('utf-8', 'replace'), i + nl

total_frames = 0
atlas_info = []
bad = []
for r, _, fs in os.walk(ATL):
    for f in fs:
        if not f.endswith('.atlas'): continue
        fp = os.path.join(r, f)
        d = open(fp, 'rb').read()
        if d[:4] != b'BATL':
            bad.append((f, 'no BATL')); continue
        i = 4
        # first record: sheet name
        try:
            sheet, i = rstr(d, i)
        except Exception:
            bad.append((f, 'no sheet name')); continue
        # sheet dims: w u32? test against PNG
        png = sheet.replace('\\', '/')
        png_path = os.path.join(ATL, png.split('atlas/')[1]) if 'atlas/' in png else os.path.join(ATL, png)
        if not os.path.exists(png_path):
            png_path = os.path.join(ATL, os.path.basename(png))
        pw = ph = 0
        if os.path.exists(png_path):
            pd = open(png_path, 'rb').read(24)
            if pd[:8] == b'\x89PNG\r\n\x1a\n':
                pw, ph = struct.unpack_from('>II', pd, 16)
        # sheet rec payload: 16 bytes (w u32, h u32, ? 8 bytes) per hex: 68 35 01 00 78 78 01 00 01 00 40 00 40 00 00 00 00 00
        w1, h1 = struct.unpack_from('<II', d, i)
        i += 16
        # frame records: name + 16 bytes
        frames = 0
        ok = True
        while i < len(d):
            if d[i] > 100: ok = False; break
            try:
                name, j = rstr(d, i)
            except Exception:
                ok = False; break
            if j + 16 > len(d): ok = False; break
            w, h, x, y = struct.unpack_from('<HHHH', d, j)
            j += 16
            if w > pw or h > ph or x > pw or y > ph or (w == 0 and h == 0):
                ok = False; break
            i = j
            frames += 1
        total_frames += frames
        atlas_info.append({'file': os.path.relpath(fp, ATL).replace('\\', '/'),
                           'sheet': sheet, 'sheet_dims': (w1, h1), 'png': (pw, ph),
                           'frames': frames, 'ok': ok})
        if not ok:
            bad.append((f, 'frame parse stop at %d/%d' % (frames, len(d))))

print('atlases:', len(atlas_info), 'total frames:', total_frames, 'bad:', len(bad))
for b in bad[:10]:
    print('  bad:', b)

# size buckets of frames
sizes = collections.Counter()
names = []
for a in atlas_info:
    pass
# aggregate by top dir
top = collections.Counter()
for a in atlas_info:
    t = a['file'].split('/')[0] if '/' in a['file'] else 'root'
    top[t] += a['frames']
print('\nframes by atlas group (top 25):')
for t, c in top.most_common(25):
    print('  %-24s %6d frames' % (t, c))

# atlas count by group
tcount = collections.Counter()
for a in atlas_info:
    t = a['file'].split('/')[0] if '/' in a['file'] else 'root'
    tcount[t] += 1
print('\natlas files by group (top 25):')
for t, c in tcount.most_common(25):
    print('  %-24s %6d atlases' % (t, c))

json.dump(atlas_info, open(os.path.join(HERE, 'atlas_info.json'), 'w'), indent=0)
print('\nwrote atlas_info.json')
