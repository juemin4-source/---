#!/usr/bin/env python3
import os, collections, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')
RES = os.path.join(HERE, 'res_extracted')

def frame_names(path, limit=30):
    d = open(path, 'rb').read()
    i = 4
    nl = d[i]; i += 1 + nl
    # sheet payload: unknown size. Find first plausible frame: scan for u8len+ASCII + 8 bytes whxy
    names = []
    j = i
    while j < len(d) and len(names) < limit:
        nl2 = d[j]
        if 2 <= nl2 <= 60:
            cand = d[j+1:j+1+nl2]
            if all(32 <= c < 127 for c in cand):
                q = j + 1 + nl2
                if q + 9 <= len(d):
                    w, h, x, y = __import__('struct').unpack_from('<HHHH', d, q)
                    if 1 <= w <= 2048 and 1 <= h <= 2048:
                        names.append((cand.decode(), w, h, x, y))
                        # advance: try T 0..16 to find next name
                        k = q + 8
                        adv = False
                        for T in range(0, 17):
                            k2 = k + T
                            if k2 >= len(d): break
                            nl3 = d[k2]
                            if 2 <= nl3 <= 60 and all(32 <= c < 127 for c in d[k2+1:k2+1+nl3]):
                                j = k2; adv = True; break
                        if not adv:
                            break
                        continue
        j += 1
    return names

for a in ['zombie.atlas', 'common.atlas', 'ui.atlas', 'castle.atlas', 'fxCommon.atlas', 'heroSkins.atlas']:
    p = os.path.join(ATL, a)
    if not os.path.exists(p): continue
    names = frame_names(p, 15)
    print('=== %s -> first frames:' % a)
    for n, w, h, x, y in names[:15]:
        print('   %-28s %3dx%-3d @ %d,%d' % (n, w, h, x, y))
    print()

# anims dirs
print('=== anims/ (dirs = character anim sets) ===')
for f in sorted(os.listdir(os.path.join(RES, 'anims'))):
    fp = os.path.join(RES, 'anims', f)
    if os.path.isdir(fp):
        fs = os.listdir(fp)
        print('  DIR  %-24s %3d files %s' % (f, len(fs), str(fs[:6])))
    else:
        print('  FILE %-24s %d bytes' % (f, os.path.getsize(fp)))
