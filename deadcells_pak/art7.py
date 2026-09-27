#!/usr/bin/env python3
import os, struct, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

def frame_names(path):
    d = open(path, 'rb').read()
    i = 4
    nl = d[i]; i += 1 + nl
    names = []
    j = i
    while j < len(d) and len(names) < 500:
        nl2 = d[j]
        if 2 <= nl2 <= 60:
            cand = d[j+1:j+1+nl2]
            if all(32 <= c < 127 for c in cand):
                q = j + 1 + nl2
                if q + 9 <= len(d):
                    w, h, x, y = struct.unpack_from('<HHHH', d, q)
                    if 1 <= w <= 2048 and 1 <= h <= 2048:
                        names.append(cand.decode())
                        k = q + 8
                        adv = False
                        for T in range(0, 17):
                            k2 = k + T
                            if k2 >= len(d): break
                            nl3 = d[k2]
                            if 2 <= nl3 <= 60 and all(32 <= c < 127 for c in d[k2+1:k2+1+nl3]):
                                j = k2; adv = True; break
                        if not adv: break
                        continue
        j += 1
    return names

for pair in [('swamp.atlas', 'swamp_n.atlas'), ('lighthouse.atlas', 'lighthouse_n.atlas'), ('castle.atlas', None)]:
    a, b = pair
    if os.path.exists(os.path.join(ATL, a)):
        na = frame_names(os.path.join(ATL, a))
        print('=== %s : %d frames, sample: %s' % (a, len(na), na[:6]))
        if b and os.path.exists(os.path.join(ATL, b)):
            nb = frame_names(os.path.join(ATL, b))
            sa = set(na); sb = set(nb)
            print('    %s : %d frames, same-name overlap: %d/%d, sample: %s' % (
                b, len(nb), len(sa & sb), len(sa), nb[:6]))
