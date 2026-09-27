#!/usr/bin/env python3
import os, io, sys, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')
RES = os.path.join(HERE, 'res_extracted')

# 1. all anims entries
print('=== anims/ full ===')
for f in sorted(os.listdir(os.path.join(RES, 'anims'))):
    fp = os.path.join(RES, 'anims', f)
    if os.path.isdir(fp):
        fs = sorted(os.listdir(fp))
        jf = [x for x in fs if x.endswith('.json')]
        ver = '?'
        if jf:
            jd = open(os.path.join(fp, jf[0]), 'r', encoding='utf-8', errors='replace').read()
            m = json.loads(jd) if jd.strip().startswith('{') else None
            if isinstance(m, dict):
                ver = m.get('spine', m.get('version', '?'))
                sk = m.get('skeleton', {})
                skins = m.get('skins', {})
                skin_names = list(skins.keys()) if isinstance(skins, dict) else skins
                print('  DIR  %-20s spine=%s  anims=%d  skins=%s' % (
                    f, ver, len(m.get('animations', {})), str(skin_names)[:60]))
            else:
                print('  DIR  %-20s (json not spine v3)' % f)
        else:
            print('  DIR  %-20s %s' % (f, fs))
    else:
        print('  FILE %-20s %d bytes' % (f, os.path.getsize(fp)))

# 2. .satlas files (libGDX spine atlas)
print('\n=== .satlas samples ===')
for r, _, fs in os.walk(ATL):
    for f in fs:
        if f.endswith('.satlas'):
            d = open(os.path.join(r, f), 'r', encoding='utf-8', errors='replace').read()
            print('--- %s' % os.path.relpath(os.path.join(r, f), ATL))
            print(d[:400])
            break
    else:
        continue
    break

# 3. atlas .json files - what are they
print('\n=== atlas/*.json (first 8) ===')
n = 0
for f in sorted(os.listdir(ATL)):
    if f.endswith('.json'):
        n += 1
        if n <= 8:
            d = open(os.path.join(ATL, f), 'r', encoding='utf-8', errors='replace').read()
            print('  %s (%d): %s' % (f, len(d), d[:180].replace('\n', ' ')))
print('total:', n)

# 4. scroller/ + textures/ + gradients/ + fonts/
for sub in ['scroller', 'textures', 'gradients', 'fonts']:
    p = os.path.join(RES, sub)
    fs = sorted(os.listdir(p))
    print('\n=== %s/ (%d files) sample:' % (sub, len(fs)))
    for f in fs[:8]:
        print('   ' + f)
