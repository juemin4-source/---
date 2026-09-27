#!/usr/bin/env python3
"""Re-extract res.pak with corrected data base (ofs relative to len_header=238570)."""
import struct, os, json

PAK = r"G:\SteamLibrary\steamapps\common\Dead Cells\res.pak"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "res_extracted")
fl = json.load(open(os.path.join(HERE, "pak_filelist.json")))
d = open(PAK, "rb").read()
BASE = 238570   # = len_header; entry ofs is relative to this
os.makedirs(OUT, exist_ok=True)
bad = 0
for path, ofs, ln, chk in fl:
    p = path.replace("\\", "/").lstrip("/")
    dst = os.path.join(OUT, p)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if ofs + ln > len(d) - BASE:
        bad += 1; continue
    with open(dst, "wb") as fo:
        fo.write(d[BASE + ofs: BASE + ofs + ln])
print("extracted", len(fl) - bad, "bad", bad)

# sample a tmx header
s = os.path.join(OUT, "tiled/tmx/Common/Arena1.tmx")
print("Arena1 head:", open(s,'rb').read()[:40])
