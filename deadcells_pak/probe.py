#!/usr/bin/env python3
import struct, sys, base64, zlib

d = open(sys.argv[1], 'rb').read()
p = 0
def u8():
    global p; v = d[p]; p += 1; return v
def u16():
    global p; v = struct.unpack_from('<H', d, p)[0]; p += 2; return v
def u32():
    global p; v = struct.unpack_from('<I', d, p)[0]; p += 4; return v
def f32():
    global p; v = struct.unpack_from('<f', d, p)[0]; p += 4; return v
def s():
    global p; n = u8(); v = d[p:p+n].decode('utf-8','replace'); p += n; return v

print('magic', d[:4])
print('fmtver', u8())
print('tiled_ver', s())
print('tiled_build', s())
tw, th, mw, mh, lc = u32(), u32(), u32(), u32(), u32()
print('tile', tw, th, 'map', mw, mh, 'layers', lc)
# extra header fields before first layer
extra = []
# probe: print next 12 bytes as candidates
import io
print('--- probing extra header at p=%d ---' % p)
print(d[p:p+16].hex(' '))
