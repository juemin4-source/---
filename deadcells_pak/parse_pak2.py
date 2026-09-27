#!/usr/bin/env python3
"""Dead Cells res.pak v1 (heaps .pak) parser + extractor.
Reverse-engineered layout:
  root entry : name (null-terminated), u8 flag(1=dir), u32le count, children
  dir entry  : u8 name_len, name, u8 flag(1), u32le count, children
  file entry : u8 name_len, name, u8 flag(0), u32le ofs, u32le len, u32le checksum
Header starts at 12; "DATA" magic sits at 12+len_header; data at HDR_END+4.
"""
import struct, os, json

PAK = r"G:\SteamLibrary\steamapps\common\Dead Cells\res.pak"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "res_extracted")
LIST_OUT = os.path.join(HERE, "pak_filelist.json")

data = open(PAK, "rb").read()
lh, ld = struct.unpack_from("<II", data, 4)
HDR_END = 12 + lh
DATA_BASE = HDR_END + 4
print("len_header", lh, "len_data", ld, "HDR_END", HDR_END, "DATA magic:", data[HDR_END:HDR_END+4])

files = []
errors = []

def parse_dir(buf, pos, depth, prefix, name):
    flag = buf[pos]; pos += 1
    if flag & 1:
        cnt, = struct.unpack_from("<I", buf, pos); pos += 4
        if depth <= 1:
            print("  " * depth + name + " [dir %d]" % cnt)
        for i in range(cnt):
            try:
                pos = parse_entry(buf, pos, depth + 1, prefix + name + "/")
            except Exception as e:
                errors.append((prefix + name + "/ child " + str(i), str(e)))
                return pos
    else:
        ofs, ln = struct.unpack_from("<II", buf, pos)
        chk, = struct.unpack_from("<I", buf, pos + 8)
        pos += 12
        files.append((prefix + name, ofs, ln, chk))
        if depth <= 1:
            print("  " * depth + name + " [file ofs=%d len=%d]" % (ofs, ln))
    return pos

def parse_entry(buf, pos, depth, prefix):
    nlen = buf[pos]; pos += 1
    if nlen == 0 or nlen > 300 or pos + nlen > len(buf):
        raise ValueError("bad name len %d at %s" % (nlen, prefix))
    name = buf[pos:pos+nlen].decode('utf-8', 'replace'); pos += nlen
    return parse_dir(buf, pos, depth, prefix, name)

nul = data.index(b"\x00", 12, 200)
root_name = data[12:nul].decode('utf-8', 'replace')
flag = data[nul+1]
cnt, = struct.unpack_from("<I", data, nul+2)
print("root:", root_name, "flag", flag, "count", cnt)
pos = nul + 6
for i in range(cnt):
    try:
        pos = parse_entry(data, pos, 1, "")
    except Exception as e:
        errors.append(("top child " + str(i), str(e)))
        print("ERR top child", i, e)
        break

print("header parsed to", pos, "expected HDR_END", HDR_END, "MATCH" if pos == HDR_END else "MISMATCH")
print("files:", len(files), "errors:", len(errors))
total = sum(f[2] for f in files)
print("sum(file lens) =", total, "len_data =", ld, "diff =", ld - total)
for e in errors[:10]:
    print("ERR:", e)

with open(LIST_OUT, "w") as f:
    json.dump(files, f)
print("wrote", LIST_OUT)

os.makedirs(OUT, exist_ok=True)
bad = 0
for path, ofs, ln, chk in files:
    p = path.replace("\\", "/")
    while p.startswith("/"):
        p = p[1:]
    dst = os.path.join(OUT, p)
    d = os.path.dirname(dst)
    if d:
        os.makedirs(d, exist_ok=True)
    if ofs + 4 + ln > len(data):
        bad += 1
        continue
    with open(dst, "wb") as fo:
        fo.write(data[ofs + 4: ofs + 4 + ln])
print("extracted", len(files) - bad, "bad", bad)
