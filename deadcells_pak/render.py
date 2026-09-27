#!/usr/bin/env python3
"""Render decoded Dead Cells rooms as inline SVG floor plans + HTML report."""
import struct, zlib, base64, os, re, json, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, 'res_extracted/tiled/tmx')
B64 = re.compile(rb'[A-Za-z0-9+/=]{40,}')

def rstr(d, p):
    n = d[p]; p += 1
    return d[p:p+n].decode('utf-8', 'replace'), p + n

def header(path):
    d = open(path, 'rb').read()
    for off in range(8, 28):
        tw, th, mw, mh = struct.unpack_from('<HHHH', d, off)
        if tw == th and 4 <= mw <= 512 and 4 <= mh <= 512 and tw <= 128:
            return tw, th, mw, mh, d
    raise ValueError('dims')

def grids(path, mw, mh):
    d = open(path, 'rb').read()
    want = mw * mh * 4
    out = []
    for m in B64.finditer(d):
        b64 = m.group()
        try:
            dec = zlib.decompress(base64.b64decode(b64 + b'=' * (-len(b64) % 4)))
        except Exception:
            continue
        if len(dec) == want:
            out.append(struct.unpack('<%dI' % (want // 4), dec))
    return out

def border_doorways(col, mw, mh):
    sides = {}
    def gap_runs(vals, inside):
        runs = []
        i = 0; n = len(vals)
        while i < n:
            if vals[i] == 0:
                j = i
                while j < n and vals[j] == 0: j += 1
                bounded = (i == 0 or vals[i-1] != 0) and (j == n or vals[j] != 0)
                inside_open = any(inside[k] == 0 for k in range(i, j))
                if bounded and inside_open:
                    runs.append((i, j, j - i))
                i = j
            else:
                i += 1
        return runs
    top = list(col[0:mw]); bot = list(col[(mh-1)*mw:mh*mw])
    topin = list(col[mw:2*mw]); botin = list(col[(mh-2)*mw:(mh-1)*mw])
    lef = [col[y*mw] for y in range(mh)]; rig = [col[y*mw+mw-1] for y in range(mh)]
    lefin = [col[y*mw+1] for y in range(mh)]; rigin = [col[y*mw+mw-2] for y in range(mh)]
    sides['N'] = gap_runs(top, topin); sides['S'] = gap_runs(bot, botin)
    sides['W'] = gap_runs(lef, lefin); sides['E'] = gap_runs(rig, rigin)
    return sides

def svg_room(col, mw, mh, sides, scale=6):
    W, H = mw * scale, mh * scale
    p = ['<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' % (W, H)]
    p.append('<rect width="%d" height="%d" fill="#565b6b"/>' % (W, H))
    for y in range(mh):
        for x in range(mw):
            if col[y*mw+x] == 0:
                p.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#1b1e27"/>' % (x*scale, y*scale, scale, scale))
    colmap = {'N': '#f0a929', 'S': '#f0a929', 'W': '#3fb3f0', 'E': '#3fb3f0'}
    for s, runs in sides.items():
        for (a, b, w) in runs:
            c = colmap[s]
            if s == 'N':
                for x in range(a, b+1):
                    p.append('<rect x="%d" y="0" width="%d" height="%d" fill="%s"/>' % (x*scale, scale, scale, c))
            elif s == 'S':
                for x in range(a, b+1):
                    p.append('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x*scale, (mh-1)*scale, scale, scale, c))
            elif s == 'W':
                for y in range(a, b+1):
                    p.append('<rect x="0" y="%d" width="%d" height="%d" fill="%s"/>' % (y*scale, scale, scale, c))
            elif s == 'E':
                for y in range(a, b+1):
                    p.append('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % ((mw-1)*scale, y*scale, scale, scale, c))
    p.append('</svg>')
    return ''.join(p)

def pick(biome_dir, maxw=45, maxh=30):
    cand = []
    for f in sorted(os.listdir(biome_dir)):
        if not f.endswith('.tmx'): continue
        fp = os.path.join(biome_dir, f)
        try:
            tw, th, mw, mh, _ = header(fp)
            if 16 <= mw <= maxw and 10 <= mh <= maxh:
                cand.append((mw, mh, fp, f))
        except Exception:
            pass
    if not cand:
        return None
    cand.sort(key=lambda t: (abs(t[0]-30), abs(t[1]-20)))
    return cand[0]

biomes = ['Prison', 'Common', 'Courtyard', 'AncientTemple', 'Shipwreck', 'ClockTower',
          'CavernCeil', 'Astrolab', 'DookuCastle', 'SewerCorridor', 'Cemetery', 'TumulusIndoor',
          'BossRush', 'Bank', 'Pit', 'Greenhouse', 'StiltVillage', 'RichterCastle', 'LoreInside', 'BossBeholder']
out = {}
for b in biomes:
    bd = os.path.join(BASE, b)
    if not os.path.isdir(bd): continue
    s = pick(bd)
    if not s: continue
    mw, mh, fp, f = s
    gs = grids(fp, mw, mh)
    col = gs[0]
    sides = border_doorways(col, mw, mh)
    nd = sum(1 for s_ in 'NSEW' if sides[s_])
    out[b] = {'file': f, 'w': mw, 'h': mh, 'area': mw*mh, 'doors': nd,
              'sides': {s_: len(v) for s_, v in sides.items()}, 'svg': svg_room(col, mw, mh, sides)}
    print('%-16s %s %dx%d doors=%d' % (b, f, mw, mh, nd))

json.dump({k: {kk: vv for kk, vv in v.items() if kk != 'svg'} for k, v in out.items()},
          open(os.path.join(HERE, 'samples.json'), 'w'), indent=1)

stats = json.load(open(os.path.join(HERE, 'map_design.json')))
type_hist = stats['type_hist']
side_hist = stats['side_hist']
biome_data = stats['biomes']

topo_order = ['cross', 'junction', 'corridor', 'corner', 'deadend', 'isolated']
topo_labels = {'cross': '4门 十字', 'junction': '3门 三通', 'corridor': '2门 走廊', 'corner': '2门 转角', 'deadend': '1门 死路', 'isolated': '0门 封闭'}
type_hist2 = {k: type_hist.get(k, 0) for k in topo_order}

def barrows(dist, labels):
    mx = max(dist.values()) if dist else 1
    rows = []
    for k in dist:
        v = dist[k]
        lab = labels.get(k, str(k))
        rows.append('<div class="row"><span class="lab">%s</span><div class="track"><div class="fill" style="width:%.1f%%;background:#f0a929"></div></div><span class="num">%d</span></div>' % (lab, (v/mx*100), v))
    return ''.join(rows)

topo_bar = barrows(type_hist2, topo_labels)

bt = sorted(biome_data.items(), key=lambda kv: -kv[1]['rooms'])[:22]
brows = ''
for b, v in bt:
    t = v['types']
    brows += '<tr><td>%s</td><td>%d</td><td>%.0f</td><td>%d/%d/%d/%d</td></tr>' % (
        b, v['rooms'], v['avg_area'], t.get('cross', 0), t.get('junction', 0), t.get('corridor', 0), t.get('deadend', 0))

room_html = []
for b, v in out.items():
    room_html.append('<div class="room"><div class="roomh">%s <span class="dim">%s · %dx%d · %d门</span></div>%s</div>'
                     % (b, v['file'], v['w'], v['h'], v['doors'], v['svg']))
rooms_html = '\n'.join(room_html)

html_final = '''<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8"><title>Dead Cells 地图设计逆向</title>
<style>
 body{font-family:"Segoe UI",system-ui,sans-serif;background:#0d0d12;color:#d8dce6;margin:0;padding:24px;}
 h1{color:#f0a929;font-size:26px;margin:0 0 4px;}
 h2{color:#8ab4ff;font-size:18px;margin:28px 0 10px;border-left:3px solid #f0a929;padding-left:10px;}
 .sub{color:#7a8090;font-size:13px;margin-bottom:18px;}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;margin-bottom:8px;}
 .card{background:#14161d;border:1px solid #23262f;border-radius:10px;padding:16px;}
 .card h3{margin:0 0 12px;font-size:15px;color:#e8ebf2;}
 .row{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12px;}
 .lab{width:88px;color:#9aa2b1;text-align:right;}
 .num{width:46px;text-align:right;color:#cfd4df;}
 .track{flex:1;height:12px;background:#1c1f28;border-radius:3px;overflow:hidden;}
 .fill{height:100%;}
 .room{background:#14161d;border:1px solid #23262f;border-radius:10px;padding:14px;margin-bottom:14px;}
 .roomh{font-size:14px;font-weight:600;margin-bottom:8px;color:#e8ebf2;}
 .dim{font-weight:400;color:#7a8090;font-size:12px;margin-left:8px;}
 .room svg{width:100%;height:auto;display:block;border-radius:4px;}
 table{border-collapse:collapse;width:100%;font-size:12px;}
 th,td{border:1px solid #23262f;padding:6px 8px;text-align:left;}
 th{background:#1a1d26;color:#cfd4df;}
 .kv{font-size:13px;line-height:2;}
 .kv b{color:#f0a929;}
</style></head><body>
<h1>Dead Cells 地图设计逆向分析</h1>
<div class="sub">res.pak（heaps .pak v1）→ 2197 个 BTMX 二进制房间 + data.cdb（162 表）。逐格解码碰撞层，门=墙体边界缺口（5 格宽门框）。</div>

<div class="grid">
 <div class="card"><h3>房间拓扑（门数分布，2190 房）</h3>''' + topo_bar + '''</div>
 <div class="card"><h3>生物群系房间数 Top（十字/三通/走廊/死路）</h3>
 <table><tr><th>生物群系</th><th>房间</th><th>均值格</th><th>拓扑</th></tr>''' + brows + '''</table></div>
</div>

<h2>核心设计参数</h2>
<div class="kv card">
 <b>房间总数</b> 2197（解码 2190） · <b>房间类型</b> 55 种（roomType 表） · <b>生物群系</b> 63 个 · <b>楼层</b> 112 层（level 表，按 worldDepth 递进）<br>
 <b>单房尺寸</b> 最小 21×10 最大 84×67（Boss 房）；门框固定 <b>5 格宽</b>，24px/格<br>
 <b>拓扑倾向</b> 十字(4门)+三通(3门)合计 ~70% —— 鼓励环形探索、减少死路；走廊/转角/死路作节奏调剂<br>
 <b>门朝向</b> 水平门(E 87% / W 86%) 远多于垂直门(N 74% / S 57%) —— 地牢以<b>横向左右展开</b>为主，纵向为次；连通性完全由墙体边界缺口定义
</div>

<h2>示例房间平面图（每生物群系抽样）</h2>
<div class="sub">灰=墙体 · 深底=地面 · 橙=南北门框 · 蓝=东西门框</div>
''' + rooms_html + '''
</body></html>'''

open(os.path.join(HERE, 'map_report.html'), 'w', encoding='utf-8').write(html_final)
print('\nwrote map_report.html (%d rooms rendered)' % len(room_html))
