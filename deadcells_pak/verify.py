#!/usr/bin/env python3
"""Verify border-doorway detection by rendering col grids + overlaying detected doorways."""
import struct, zlib, base64, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from final import header, grids, border_doorways

def render(col, mw, mh):
    out = []
    for y in range(mh):
        out.append(''.join('#' if col[y*mw+x] else '.' for x in range(mw)))
    return out

def overlay(col, mw, mh, sides):
    """Mark detected doorways on border with distinct letters."""
    grid = [[col[y*mw+x] for x in range(mw)] for y in range(mh)]
    letters = {'N': 'n', 'S': 's', 'W': 'w', 'E': 'e'}
    for s, runs in sides.items():
        for (a, b, w) in runs:
            if s == 'N':
                for x in range(a, b+1): grid[0][x] = letters[s]
            elif s == 'S':
                for x in range(a, b+1): grid[mh-1][x] = letters[s]
            elif s == 'W':
                for y in range(a, b+1): grid[y][0] = letters[s]
            elif s == 'E':
                for y in range(a, b+1): grid[y][mw-1] = letters[s]
    def cell(c):
        if c == 0: return '.'
        if isinstance(c, str): return c
        return '#'
    return [''.join(cell(c) for c in row) for row in grid]

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'res_extracted/tiled/tmx')
samples = ['Prison/Pr1.tmx', 'Prison/Pr5.tmx', 'Common/Arena1.tmx']
for s in samples:
    fp = os.path.join(BASE, s)
    if not os.path.exists(fp):
        print('skip', s); continue
    tw, th, mw, mh, d = header(fp)
    gs = grids(fp, mw, mh)
    col = gs[0]
    sides = border_doorways(col, mw, mh)
    print('='*60)
    print(s, ' map %dx%d  doorways=%s' % (mw, mh, {k: len(v) for k, v in sides.items()}))
    print('--- raw col ---')
    for line in render(col, mw, mh):
        print(line)
    print('--- doorways marked (n/s/w/e) ---')
    for line in overlay(col, mw, mh, sides):
        print(line)
