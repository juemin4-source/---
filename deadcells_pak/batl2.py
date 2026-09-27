#!/usr/bin/env python3
"""Brute-parse heaps BATL atlas: record = u8 len, name, payload. Find stride."""
import os, struct, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
ATL = os.path.join(HERE, 'res_extracted/atlas')

d = open(os.path.join(ATL, 'achievements.atlas'), 'rb').read()
p = 4  # skip BATL
recs = []
i = p
ok = True
while i < len(d):
    nl = d[i]
    i += 1
    if i + nl > len(d): break
    name = d[i:i+nl].decode('utf-8', 'replace'); i += nl
    # probe: next is u16 w u16 h?
    w, h = struct.unpack_from('<HH', d, i)
    recs.append((name, w, h, i))
    # try stride hypotheses: after w,h what's next valid field?
    # print next 16 bytes hex for first few
    i += 2  # consume w
    # heuristic: find next record by scanning for plausible name lengths
    # instead: fixed stride test — assume layout w,h,x,y,srcX,srcY,srcW,srcH (8 u16 = 16 bytes) after name
    i += 14
    if len(recs) <= 3:
        print('name=%r w=%d h=%d next16=%s' % (name, w, h, d[i-14:i-14+16].hex(' ')))

print('records parsed with stride16:', len(recs))
# check coverage: did we land exactly at EOF?
print('end i=%d len=%d' % (i, len(d)))
# try stride 12 (w,h,x,y only + 2 more u16)
i = p
cnt = 0
while i < len(d):
    nl = d[i]; i += 1
    if i + nl > len(d): break
    i += nl + 12
    cnt += 1
print('stride12 records:', cnt, 'end i=%d' % i)
i = p
cnt = 0
while i < len(d):
    nl = d[i]; i += 1
    if i + nl > len(d): break
    i += nl + 16
    cnt += 1
print('stride16 records:', cnt, 'end i=%d' % i)
i = p
cnt = 0
while i < len(d):
    nl = d[i]; i += 1
    if i + nl > len(d): break
    i += nl + 20
    cnt += 1
print('stride20 records:', cnt, 'end i=%d' % i)
