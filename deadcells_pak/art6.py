#!/usr/bin/env python3
import os, io, sys, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, 'res_extracted')

# scroller structure (parallax per biome)
print('=== scroller/ tree (depth 2) ===')
SC = os.path.join(RES, 'scroller')
for f in sorted(os.listdir(SC)):
    fp = os.path.join(SC, f)
    if os.path.isdir(fp):
        fs = sorted(os.listdir(fp))
        print('  DIR  %-22s %3d files %s' % (f, len(fs), ' '.join(fs[:6])))
    else:
        print('  FILE %-22s %d bytes' % (f, os.path.getsize(fp)))

# gradients naming taxonomy
print('\n=== gradients/ naming (81) ===')
pat = collections.Counter()
for f in sorted(os.listdir(os.path.join(RES, 'gradients'))):
    pat[f.split('Front')[0].split('Main')[0].split('Bg')[0]] += 1
for f in sorted(os.listdir(os.path.join(RES, 'gradients')))[:20]:
    print('   ' + f)

# beheaded skins count
ATL = os.path.join(RES, 'atlas')
beheaded = [f for f in os.listdir(ATL) if f.startswith('beheaded') and f.endswith('.atlas')]
fx = [f for f in os.listdir(ATL) if f.startswith('fx') and f.endswith('.atlas')]
env = [f for f in os.listdir(ATL) if f not in beheaded and f not in fx and f.endswith('.atlas')]
print('\nbeheaded (player heads/skins) atlases:', len(beheaded))
print('fx atlases:', len(fx))
print('other atlases (enemy+env+ui):', len(env))

# per-atlas sheet size for the biggest
import struct
def png_dims(path):
    d = open(path, 'rb').read(24)
    if d[:8] != b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack_from('>II', d, 16)
big = []
for f in os.listdir(ATL):
    if f.endswith('.png'):
        d = png_dims(os.path.join(ATL, f))
        if d and d[0] >= 2048 and d[1] >= 2048:
            big.append((d[0]*d[1], f, d))
big.sort(reverse=True)
print('\ntop 10 largest sheets:')
for area, f, d in big[:10]:
    print('  %-28s %4dx%-4d %12d px' % (f, d[0], d[1], area))
tot_big = sum(a for a, _, _ in big)
print('sheets >=2048x2048:', len(big), 'total pixels: %.1f MP' % (tot_big/1e6))
