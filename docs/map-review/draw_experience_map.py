"""Authored review drawing. Explicit geometry only; never consumed by the game."""
from pathlib import Path
from html import escape

P=Path(__file__).parent
s=['''<svg xmlns="http://www.w3.org/2000/svg" width="2700" height="1900" viewBox="0 0 2700 1900">
<defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#263542" stroke-width="1"/></pattern><marker id="gold" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#e6bd71" stroke-width="2"/></marker><marker id="red" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#ed9281" stroke-width="2"/></marker><marker id="green" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#89d0b1" stroke-width="2"/></marker></defs>
<style>text{font-family:'Microsoft YaHei',sans-serif;fill:#dbe6eb}.room{font-size:24px;font-weight:700}.small{font-size:18px}.tiny{font-size:16px}.note{font-size:21px}.muted{fill:#9db4c0}.walk{fill:#304653;stroke:#9cafba;stroke-width:3;stroke-linejoin:round}.solid{fill:#101c26;stroke:#75909f;stroke-width:3}</style>
<rect width="2700" height="1900" fill="#101a23"/><rect x="35" y="170" width="2630" height="1470" fill="url(#grid)" stroke="#405360"/>
<text x="55" y="58" font-size="37" font-weight="700">永蚀 / 体验驱动地图 C · 审核剖面</text>
<text x="55" y="99" class="note">去程认识环境，回程重新理解环境。先审核地形与路线，不将图上的单位直接当游戏像素。</text>
<text x="55" y="137" class="small muted">浅色为通行空间；深色为实墙与设备。主路以平走、短跳与缓阶衔接；无长梯。所有标注都是待实现设计。</text>''']
def text(x,y,t,cls='small',color=None):
 s.append(f'<text x="{x}" y="{y}" class="{cls}"'+(f' style="fill:{color}"' if color else '')+'>'+escape(t)+'</text>')
def path(d,cls='walk'):
 s.append(f'<path d="{d}" class="{cls}"/>')
def route(d,color,marker=None,width=5):
 s.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-dasharray="12 9" stroke-linecap="round"'+(f' marker-end="url(#{marker})"' if marker else '')+'/>')
def platform(x,y,w):
 s.append(f'<path d="M{x} {y}h{w}" stroke="#b1c5cd" stroke-width="7"/>')
def box(x,y,w,h):
 s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="solid"/>')
def item(x,y,label):
 s.append(f'<path d="M{x} {y-15}l15 15l-15 15l-15-15z" fill="#e6bd71"/>')
 text(x+23,y+6,label,'tiny','#e6bd71')
def creature(x,y,kind):
 if kind=='hunter':s.append(f'<path d="M{x} {y-30}l20 30h-40z" fill="#ed9281"/>')
 elif kind=='scav':s.append(f'<ellipse cx="{x}" cy="{y-10}" rx="13" ry="10" fill="#c4c38b"/>')
 elif kind=='food':s.append(f'<path d="M{x-17} {y-5}l13-10l11 8l13-5" stroke="#b99caa" stroke-width="7" fill="none"/>')
 elif kind=='nest':s.append(f'<path d="M{x-30} {y}q0-37 30-25q30-12 30 25z" fill="#725858" stroke="#d4877b" stroke-width="3"/>')
 elif kind=='floater':s.append(f'<circle cx="{x}" cy="{y-15}" r="14" fill="none" stroke="#cba4dc" stroke-width="6"/><path d="M{x-12} {y}l-7 15m19-15v20m12-20l7 15" stroke="#cba4dc" stroke-width="3"/>')

# Architectural connections are broad traversable spaces. Room shapes overlay their joints.
# Workshop to observation: offset mezzanine stair, not a ladder shaft.
path('M730 1390H810L945 1220H1025V1320H985L840 1500H730Z')
# Fork, two distinct approaches to pump: equipment-top passage vs freight corridor.
path('M1110 1220H1350L1430 1280H1510V1380H1380L1300 1320H1110Z')
path('M1080 1225V1160H990V1030H1080V1000H1260V1110H1170V1140H1180V1310H1080Z')
# Warehouse far end returns west into pump lower level; one folded aisle.
path('M1870 1230V1110H1590V1190H1790V1310H1870Z')
# Pump exits at upper right to sheltered desk.
path('M1570 960H1670V820H1580V850H1520V960Z')
# Desk to upper control: winding but broad passage around a utility core.
path('M1750 780H1850V650H1750V555H1850V470H1760V490H1650V720H1750Z')
# Optional records spur: descending blind side pocket, only loot, not main progression.
path('M1660 635H1540V560H1450V650H1570V700H1660Z')
# Light service access from desk to rig: short jumps over cable ducts.
path('M1780 805H1960V760H2180V850H2010V885H1780Z')
# Control to rig outer descent.
path('M2240 475H2420V640L2320 740H2240V820H2360L2500 680V390H2240Z')
# Short cargo route: under rig -> pump-side service landing -> cargo exit.
path('M2160 880H2260L2170 990H1860V1060H1930L2150 1240H2240V1330H2100L1830 1110H1770V910H2110Z')
# Pump-side opening lets local creatures and the player reach the short cargo route.
path('M1590 1080H1800V1180H1590Z')
# Long cargo bypass has a broad stair, separate from the previous loop.
path('M2300 900H2510V970L2420 1060V1150L2500 1230V1450H2320V1350H2400V1270L2320 1190V1020L2420 920H2300Z')
# Enemy food duct joins drainage to pump below player's maintenance passage.
path('M1040 1380H1110L1240 1130H1310V1220H1290L1170 1470H1040Z')
# Remote-open return door ties warehouse to observation, not back through every fight.
path('M1520 1440H1190V1360H1090V1430H1130V1515H1570V1400H1520Z')

# 1. Long horizontal workshop: one work bay, useful overhead bench, open retreat.
path('M90 1390H270V1360H560V1380H760V1500H830V1590H90Z')
box(395,1525,90,65);platform(535,1470,125)
text(110,1428,'气闸 / 普通物资撤离','room');text(355,1414,'01 维修工位','room')
s.append('<rect x="120" y="1500" width="35" height="90" fill="#7bb89e"/>')
creature(560,1590,'hunter');item(617,1450,'首个器官试用支路')
text(343,1555,'工作台','tiny');text(510,1630,'首次战斗留退路，不锁门','small')
# Player marker, represented at one spot only to avoid mistaken scale reference.
s.append('<circle cx="235" cy="1540" r="8" fill="#fff0d5"/><path d="M235 1548v22m0-15l-12 10m12-10l12 10m-12 5l-10 15m10-15l10 15" stroke="#fff0d5" stroke-width="4"/>')

# 2. Observation and drainage are two genuinely separate levels.
path('M930 1190H1200V1220H1300V1320H925V1260H930Z')
path('M880 1380H1100V1330H1170V1500H900V1470H830V1440H880Z')
text(949,1226,'02 排污观察口','room')
s.append('<path d="M952 1320H1060" stroke="#96d1e6" stroke-width="9" stroke-dasharray="13 5"/>')
creature(880,1468,'nest');creature(965,1500,'scav');creature(1020,1500,'food')
item(1080,1455,'电池');text(922,1353,'隔窗先看，下去可退出','tiny','#96d1e6')
text(1150,1280,'03 分路','room')
# Controllable drop and side ascent: not an invisible link between observation and food.
platform(1090,1390,70);platform(1095,1355,70)

# Left branch: devices create horizontal/vertical alternatives, not a new rectangular room.
path('M880 1070H950V955H1135V1000H1220V1090H1130V1190H1040V1150H950V1140H880Z')
box(980,1080,65,110);platform(965,1022,120);platform(1100,1060,95)
text(925,990,'维修路 / 较短','room');text(872,1216,'跳设备绕过食物区','tiny')
creature(1090,1185,'food');creature(1160,1185,'hunter')

# Right branch: asymmetrical loading gallery, alternating sight blockers and a tall rack.
path('M1420 1220H1630V1190H1770V1220H1940V1310H1890V1460H1490V1410H1420Z')
box(1520,1360,65,100);box(1695,1315,65,145);box(1810,1400,80,60)
platform(1500,1305,100);platform(1660,1270,125);platform(1800,1300,90)
creature(1630,1460,'hunter');item(1715,1245,'可选宝箱兽')
text(1440,1255,'装卸道 / 具体物资','room');text(1490,1492,'货架切断长射线 · 地面绕行','tiny')

# 4. Central landmark: bridge ends and lower flanking route around the pump.
path('M1220 850H1440V800H1580V870H1630V1190H1280V1140H1220Z')
path('M1350 925H1450V960H1490V1100H1325V990H1350Z','solid')
platform(1280,912,230);platform(1510,967,100);platform(1250,1040,70)
text(1250,883,'04 主泵厅','room');text(1350,1025,'泵体','room')
creature(1295,1135,'scav');creature(1530,1190,'food');creature(1560,967,'hunter')
text(1280,1225,'从两侧进入同一地标；回程再经过侧缘','tiny')
# 5. Relief ledge has a view of the actual pump below.
path('M1590 735H1800V860H1680V835H1590Z')
text(1608,769,'05 泵后值守台','room');item(1700,809,'书籍 / 设施图')
s.append('<path d="M1595 834H1680" stroke="#96d1e6" stroke-width="7" stroke-dasharray="13 5"/>')
text(1535,706,'回望战场，整理后决定是否深入','tiny')
# Optional records closet differs in silhouette and purpose.
path('M1320 525H1515V645H1380V615H1320Z')
item(1360,575,'资料支路');text(1325,676,'带走书籍 / 蓝图','tiny')

# 6. Control: offset route over invaded plant, two distinct cover heights and floating nests.
path('M1700 350H1810V290H2030V340H2200V315H2330V480H2240V590H2040V550H1910V615H1750V555H1700Z')
box(1840,445,100,110);box(2090,440,85,150)
platform(1770,480,60);platform(1915,399,120);platform(2160,385,130)
creature(2040,415,'floater');creature(2240,540,'nest');creature(1980,485,'floater')
text(1730,382,'06 被侵蚀的控制层','room');item(2250,353,'供电闸')
item(1945,320,'星骸地标');text(1710,267,'改变站位问题，不只是更高血量','small')
route('M2250 372V670H2570V1370H2310','#668778',None,3)
text(2400,320,'电力线 / 非道路','tiny','#89bca3')

# 7. Rig platform clearly higher than BOTH freight routes. Local stair/ramp serves cargo.
path('M2120 700H2220V650H2360V720H2420V920H2310V890H2120Z')
box(2180,845,130,45);item(2230,817,'大型设备')
text(2140,747,'07 吊装区','room');text(2150,784,'先看运输路，再拿货','tiny')
# No ladders on the main route. Light approach is an optional two-jump access.
platform(1990,815,65);platform(2070,782,65)
text(1920,915,'轻装检修口','tiny','#95c7dc')
# Extraction is not a boss arena.
path('M2100 1280H2360V1450H2060V1390H2100Z')
text(2105,1320,'货运撤离站','room')
s.append('<rect x="2280" y="1360" width="40" height="90" fill="#7bb89e"/>')
text(2110,1478,'供电后可用；不凭空刷守点波','tiny')

# Clear physical gate only on the return shortcut.
s.append('<path d="M1200 1440V1515" stroke="#e6bd71" stroke-width="9"/>')
text(1200,1560,'远侧开门 → 认出观察口','small','#e6bd71')
# Cargo schematic strips explicitly follow the carved passages.
s.append('<g id="cargo-layer">')
route('M2210 885L2150 950H1818V1070L2130 1300H2230','#89d0b1','green',6)
route('M2350 889H2460V950L2360 1040V1160L2450 1250V1400H2330','#89d0b1','green',6)
text(1818,1020,'短路：重走泵厅侧缘','small','#89d0b1')
text(2430,1100,'长路','small','#89d0b1');text(2430,1135,'外装卸廊','tiny','#89d0b1')
text(1910,1165,'08 带货回程：绕行 / 放下战斗 / 弃货','small','#89d0b1')
s.append('</g><g id="ecology-layer">')
route('M915 1475H1080L1140 1370L1260 1175H1310','#ed9281','red',4)
route('M1235 1180L1140 1370L1070 1470','#ed9281','red',4)
text(1210,1367,'食物通道：允许真实地面迁移','tiny','#ed9281')
route('M1290 1150H1530','#ed9281','red',4)
s.append('</g>')
# Pacing captions are anchored to their physical causes, not generic room functions.
text(100,1190,'前段：快速接敌 → 试能力 → 看懂生态','room','#e6bd71')
text(100,1230,'左路选择介入与绕行；右路选择交战与搜索。','small')
text(100,1262,'泵厅是第一次发挥，不是第一分钟就互秒。','small')
text(100,1294,'两边都能养成构筑，不设置必需器官钥匙。','small')
text(420,630,'泵站主体 / 未开放结构','room','#9db4c0')
text(420,668,'本次可探索区域沿设施右侧向上展开。','small','#9db4c0')


text(470,800,'比例待定：此图审核构成与相邻关系。','tiny','#9db4c0')

# Bottom review legend and assumptions.
text(60,1700,'看图顺序','room','#e6bd71')
text(60,1738,'从左下气闸出发，沿维修工位到观察口；选左维修路或右装卸道，汇入中部泵厅。','note')
text(60,1774,'从值守台上探控制层，恢复供电；吊装区拿货后沿绿线回到右下货运站，或弃货返回气闸。','note')
text(60,1827,'图中空间是手工逐处绘制；跳跃高差、坡面、碰撞和敌人寻路还须在实施阶段验证。','small','#9db4c0')
text(60,1864,'本图不保证每局出现成熟怪或 Apex。清理食物、清巢或早撤，应允许一次平静的回程。','small','#9db4c0')
text(2010,1700,'图例','room','#e6bd71')
text(2010,1738,'△ 猎手　● 幼体　◇ 收益','small')
text(2010,1774,'红虚线：生态通路意图','small','#ed9281')
text(2010,1810,'绿虚线：两条搬运回程','small','#89d0b1')
text(2010,1846,'蓝虚线：观察窗（不可穿过）','small','#96d1e6')
s.append('</svg>')
svg=''.join(s)
(P/'experience-map-C.svg').write_text(svg,encoding='utf-8')
# Focus views are crops of this very map, never redesigned independent illustrations.
views=[('all','全图','0 0 2700 1900'),('start','① 首战与生态观察','60 1180 1290 475'),('fork','② 分路与泵厅','850 705 1120 880'),('deep','③ 深入与搬运','1530 250 1090 1250')]
for key,title,v in views:
 if key!='all':(P/f'experience-map-C-{key}.svg').write_text(svg.replace('viewBox="0 0 2700 1900"',f'viewBox="{v}"').replace('width="2700" height="1900"',f'width="{v.split()[2]}" height="{v.split()[3]}"',1),encoding='utf-8')
nav=''.join(f'<a href="?view={k}" class="tab" data-view="{k}">{t}</a>' for k,t,v in views)
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>永蚀 · 体验驱动地图 C</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#101a23;color:#dbe6eb;font:16px/1.6 'Microsoft YaHei',sans-serif}header{padding:16px 24px;background:#17252e;border-bottom:1px solid #49606d;position:sticky;top:0;z-index:2}nav{display:flex;gap:8px;flex-wrap:wrap}a{color:#bed1dd}nav a,button{padding:8px 14px;background:#293e4b;border:1px solid #526b79;color:#dbe6eb;text-decoration:none;cursor:pointer;font:inherit}.active{background:#cdb078;color:#121b24}header p{margin:0 0 10px;color:#a6bdc9;font-size:14px}main{overflow:auto}img{display:block;width:100%;height:auto;min-width:1000px}footer{padding:20px 30px;border-top:1px solid #405360}</style><header><p>体验驱动地图 C · 待确认，未接入游戏。局部图直接放大全图同一处，不另画一套房间。</p><nav>'''+nav+'''<button id="zoom">原尺寸 / 适应窗口</button><a href="experience-C.html">阅读体验稿 C</a></nav></header><main><img id="map" alt="永蚀体验驱动地图 C：从左下出发，分路上探，搬货沿右侧两条路线撤离" src="experience-map-C.svg"></main><footer>审核重点：空间是否有辨识度、两条分路是否有意义、泵厅是否值得反复经过、重货回程是否保留选择。图确认后才接进游戏。</footer><script type="module">const views={all:'experience-map-C.svg',start:'experience-map-C-start.svg',fork:'experience-map-C-fork.svg',deep:'experience-map-C-deep.svg'};const key=new URLSearchParams(location.search).get('view')||'all';const img=document.getElementById('map');img.src=views[key]||views.all;document.querySelector('[data-view="'+(views[key]?key:'all')+'"]').classList.add('active');let zoom=false;document.getElementById('zoom').addEventListener('click',()=>{zoom=!zoom;img.style.width=zoom?'2700px':'100%'});</script></html>'''
# Preserve the last turn's document independently from the map review entry point.
if not (P/'experience-C.html').exists():
 (P/'experience-C.html').write_text((P/'index.html').read_text(encoding='utf-8'),encoding='utf-8')
(P/'index.html').write_text(page,encoding='utf-8')
print('Map C and three matching focus views written. No game files modified.')
