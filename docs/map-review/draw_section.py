from pathlib import Path
from html import escape

OUT=Path(__file__).parent
W,H=1600,1320
def begin(title,subtitle):
 return [f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><style>text{{font-family:'Microsoft YaHei',sans-serif;fill:#dce6eb}}.label{{font-size:18px;font-weight:700}}.small{{font-size:14px}}.dim{{fill:#91a7b4}}</style><rect width="1600" height="1320" fill="#111b24"/><text x="40" y="48" font-size="30" font-weight="700">{title}</text><text x="40" y="81" font-size="17" fill="#a9bdc8">{subtitle}</text>''']
def label(s,x,y,t,size=16,col='#dce6eb'):
 s.append(f'<text x="{x}" y="{y}" font-size="{size}" style="fill:{col}">{escape(t)}</text>')
def rect(s,x,y,w,h,c):
 s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>')
def line(s,pts,c='#91adba',width=3,dash=''):
 s.append(f'<polyline points="{pts}" fill="none" stroke="{c}" stroke-width="{width}"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>')
def platform(s,x,y,w,solid=True):
 rect(s,x,y,w,14 if solid else 5,'#526b79' if solid else '#9cb6c2')
def actor(s,x,y,kind):
 if kind=='player':
  s.append(f'<circle cx="{x}" cy="{y-22}" r="5" fill="#f0e8d5"/><path d="M{x} {y-17}v10m0-7l-7 6m7-6l7 6m-7 1l-6 7m6-7l6 7" stroke="#f0e8d5" stroke-width="3"/>')
 elif kind=='food':
  line(s,f'{x-9},{y-3} {x-2},{y-9} {x+9},{y-3}', '#b79ca1',5)
 elif kind=='hunter':
  s.append(f'<path d="M{x} {y-23}l13 22h-26z" fill="#dd8e7e"/>')
 elif kind=='scav':
  s.append(f'<circle cx="{x}" cy="{y-8}" r="8" fill="#b6b184"/>')
 elif kind=='loot':
  s.append(f'<path d="M{x} {y-21}l10 10l-10 10l-10-10z" fill="#e4c47c"/>')
 elif kind=='nest':
  s.append(f'<ellipse cx="{x}" cy="{y-9}" rx="20" ry="11" fill="#785958" stroke="#da9185" stroke-width="2"/>')

# Overview: continuous carved section with solid slab breaks and room-local geometry.
s=begin('永蚀 / 灰盒迷宫剖面 B','固定地图 · 底部出发 · 地形与功能件审核稿；不是美术效果图，也尚未接入游戏')
rect(s,35,112,1225,1105,'#080f16')
# Coordinates are drawing units, not game pixels. Interior modules are reviewed separately below.
voids=[(520,1100,240,85),(480,935,330,110),(170,945,235,95),(890,950,300,95),
 (70,740,330,130),(470,710,340,160),(900,720,300,160),
 (70,525,330,135),(465,535,340,105),(980,505,235,155),
 (65,310,320,140),(470,320,340,120),(890,310,315,145),
 (130,145,255,105),(470,140,340,105),(920,140,285,100),
 # broad playable transition spaces; steps inside, no long connector shafts
 (615,1035,180,75),(350,850,175,110),(355,985,140,45),(800,995,115,45),
 (1060,865,135,100),(390,820,95,45),(800,825,115,45),
 (540,855,160,95),(190,650,175,105),(630,630,175,95),
 (390,605,90,40),(1080,650,125,80),(800,610,195,45),(850,420,50,225),
 (180,435,170,100),(590,430,150,115),(385,395,95,45),(805,400,90,45),
 (1020,450,185,65),(240,235,145,85),(585,235,190,95),(1040,230,165,90),
 (385,205,100,40),(810,200,115,40)]
for x,y,w,h in voids: rect(s,x,y,w,h,'#293e4b')
# Three internal routes are literally ledges, cover and broken floors.
for x,y,w in [(520,1026,60),(640,999,65),(740,974,45),(640,1094,65),(705,1068,65),
 (372,916,65),(420,885,75),(1080,928,85),(1110,897,70),
 (550,922,65),(610,893,65),(220,718,75),(285,680,65),
 (650,687,65),(720,655,65),(1090,696,95),
 (210,498,65),(275,463,65),(610,505,70),(680,466,60),
 (265,294,65),(325,265,55),(610,296,60),(705,263,60),
 (1060,286,60),(1130,252,65)]: platform(s,x,y,w)
# Unique room interiors (not repeated stairs in every box).
rect(s,575,796,62,74,'#080f16');platform(s,530,777,150,False);platform(s,697,751,88,False)
rect(s,735,822,40,48,'#080f16')
platform(s,95,810,80,False);platform(s,242,778,105,False)
rect(s,150,834,40,36,'#080f16')
rect(s,965,821,50,59,'#080f16');rect(s,1090,803,60,77,'#080f16')
platform(s,931,780,100,False);platform(s,1070,754,96,False)
rect(s,130,579,60,81,'#080f16');platform(s,245,608,120,False)
rect(s,550,379,50,61,'#080f16');rect(s,700,361,45,79,'#080f16')
platform(s,98,396,100,False);platform(s,235,366,114,False)
platform(s,950,200,70,False);platform(s,1080,177,95,False)
platform(s,500,203,90,False);platform(s,650,175,130,False)
# Cargo stair must stay walkable; closely spaced steps, not jump ledges.
for i in range(6): platform(s,1040+i*24,454+i*8,24)
# Single optional lift creates a vertical return, not a mandatory ladder spine.
line(s,'875,445 875,613','#8ab9ba',2,'5 4');platform(s,856,582,38,False)
label(s,819,568,'货梯',13,'#9ed2c1')
# Room labels.
names=[(535,1124,'01 气闸 / 撤离'),(490,955,'02 维修间'),(185,968,'03 值班室'),(906,972,'04 分拣车间'),
 (85,762,'05 排水沟'),(482,733,'06 主泵厅'),(913,742,'07 仓储栈道'),
 (85,548,'08 滤水机房'),(480,558,'09 观察夹层'),(995,530,'10 货运撤离'),
 (80,333,'11 温床'),(485,343,'12 换热室'),(905,333,'13 吊装间'),
 (145,168,'14 资料库'),(485,163,'15 外环'),(935,164,'16 控制室')]
for x,y,t in names: label(s,x,y,t,17)
for x,y,k in [(560,1180,'player'),(690,1038,'hunter'),(752,970,'loot'),(230,1033,'loot'),
 (100,864,'nest'),(240,864,'food'),(190,864,'scav'),(335,864,'hunter'),
 (515,862,'scav'),(680,862,'food'),(758,817,'hunter'),
 (955,874,'hunter'),(1135,749,'loot'),(145,445,'nest'),(295,445,'food'),
 (740,240,'nest'),(1080,448,'loot'),(305,244,'loot'),(1150,235,'loot')]: actor(s,x,y,k)
for x,y,n in [(425,1008,'A'),(850,845,'B'),(850,625,'C')]:
 line(s,f'{x},{y-16} {x},{y+16}','#dfc37b',5);label(s,x-5,y-25,n,16,'#dfc37b')
line(s,'515,636 615,636','#a2cee0',5,'9 5');label(s,483,675,'观察窗 ↓',13,'#a2cee0')
line(s,'190,856 240,856 335,856','#df9487',2,'5 5')
line(s,'955,860 1040,860 1080,824','#df9487',2,'5 5')
label(s,55,1200,'整体是连续建筑剖面。内部横条是落脚点；大块黑色是实体设备 / 墙体，不是空白背景。',15)
notes=[('读图', ['浅蓝：可行走空间','黑色：实体建筑 / 设备','灰实线：实体落脚点','浅细线：可穿越跳台','金色 A/B/C：远侧开门','红三角：猎手  圆点：幼体','金菱形：资源  椭圆：巢穴']),
 ('路线意图',['下部先横向展开，再逐层上探。','下环 02→06→07→04→02','左环 06→09→08→05→06','上环 09→12→13→10→09','资料库为额外探索回报。']),
 ('尺度待物理校准',['目标整图约 8–10 屏宽，','5–6 屏高，不按这张图等比放大。','单房有长廊、夹层和大空间之分。','普通跳点留余量，不按极限摆。']),
 ('重货回程',['13 大型设备 → 缓阶 → 10 撤离。','16 恢复货运供电。','不把重货放进只有跳跃出口的房间。']),
 ('审核边界',['本图确认空间和功能关系。','顶部页签可看三个放大房间。','生态箭头是设计意图，','不代表现有程序已经实现。'])]
y=150
for title,ls in notes:
 label(s,1290,y,title,22,'#e3c889');y+=32
 for t in ls:label(s,1290,y,t,15);y+=26
 y+=32
label(s,40,1270,'B / 01   总剖面 · 尚未接入游戏，等待审核',20,'#a9c4d3')
s.append('</svg>');(OUT/'section-B.svg').write_text(''.join(s),encoding='utf-8')

def detail(name,subtitle,variant):
 s=begin(name,subtitle)
 # Each room uses a common visible 40 px grid purely for discussion.
 rect(s,60,130,1120,750,'#080f16');rect(s,100,175,1040,625,'#293e4b')
 for x in range(100,1140,40):line(s,f'{x},175 {x},800','#354b57',1)
 for y in range(200,800,40):line(s,f'100,{y} 1140,{y}','#354b57',1)
 if variant==0:
  # Doorways in side walls + rising alternative with visible destination.
  rect(s,60,670,65,130,'#293e4b');rect(s,1130,450,50,150,'#293e4b')
  rect(s,560,645,160,155,'#080f16');platform(s,245,713,130);platform(s,410,625,130)
  platform(s,550,525,180,False);platform(s,810,500,140);platform(s,1010,585,130)
  actor(s,160,795,'player');actor(s,450,795,'hunter');actor(s,890,795,'scav');actor(s,915,795,'food');actor(s,885,495,'loot')
  line(s,'180,762 400,762 520,762','#e3c888',4,'10 6')
  line(s,'200,748 300,687 470,598 625,498 870,473 1080,555','#8fc6d5',3,'8 7')
  label(s,120,653,'入口：先看到猎手与中央设备',18);label(s,550,690,'实体维修机',18)
  label(s,776,448,'从入口可见的零件箱',19,'#e3c888');label(s,943,422,'通往主泵厅',18)
  lines=['下层：接敌、绕设备，保留退回门口的空间。','上层：短跳与二段跳绕行；资源引导路线。','设备挡住视线和射线，敌人不能隔墙攻击。','高差按角色实际跳跃校准，普通路径不要求极限跳。']
 elif variant==1:
  rect(s,60,665,60,135,'#293e4b');rect(s,1130,655,50,145,'#293e4b')
  rect(s,100,175,330,250,'#080f16');rect(s,100,345,315,70,'#365660')
  line(s,'130,423 380,423','#9ecbdb',7,'15 6');platform(s,455,495,160);platform(s,685,565,145,False)
  platform(s,945,635,150);rect(s,765,730,90,70,'#080f16')
  actor(s,240,410,'player');actor(s,205,795,'nest');actor(s,470,795,'scav');actor(s,555,795,'food');actor(s,995,795,'hunter');actor(s,770,560,'loot')
  line(s,'465,780 550,780','#b7b783',4,'8 6');line(s,'990,785 870,785','#df9487',4,'8 6')
  label(s,120,325,'观察夹层：先看见，再决定下去',19);label(s,385,710,'幼体取食 →',19,'#b7b783')
  label(s,875,710,'← 猎手进入',19,'#df9487');label(s,650,526,'上层奖励 / 绕行',18,'#e3c888')
  lines=['尸骸在开阔下层，进食过程处于观察窗视野内。','猎手经右门实际走入，幼体有左侧退路。','玩家可从上层绕过、等争斗结束，或下场抢器官。','不锁门强制演出：有食物才取食，受攻击会中断。']
 else:
  rect(s,60,665,60,135,'#293e4b');rect(s,1130,655,50,145,'#293e4b')
  rect(s,100,600,370,200,'#526b79')
  for i in range(12): rect(s,470+i*40,600+i*16,40,200-i*16,'#526b79')
  platform(s,370,400,200,False);platform(s,700,335,170,False);platform(s,980,415,130,False)
  actor(s,205,595,'player');actor(s,330,595,'loot');actor(s,1035,795,'hunter')
  rect(s,1050,690,60,110,'#4a786e');label(s,1020,673,'货运出口',18,'#a3d9c1')
  line(s,'355,575 445,575 960,770 1055,770','#9dcfb9',4,'10 7')
  label(s,140,562,'吊装设备 · 拿起前能看见运输路',19,'#e3c888');label(s,500,900,'',18)
  lines=['重货线：缓阶连续落脚，运输不依赖跳跃或爬梯。','轻装线：走上方短跳路线，能快速侦察出口。','拿起设备前即可观察运输方向；可放下货物再战斗。','电力在控制室恢复，出口旁不安排凭空生成的防守波。']
 label(s,1220,180,'功能标记',22,'#e3c889')
 for i,(k,t) in enumerate([('player','玩家观察位置'),('hunter','猎手'),('scav','食腐幼体'),('food','可进食尸骸'),('loot','资源目标'),('nest','栖息 / 出生点')]):
  actor(s,1240,235+i*70,k);label(s,1270,229+i*70,t,19)
 label(s,80,950,'这间房要让玩家做什么',25,'#e3c889')
 for i,t in enumerate(lines):label(s,80,1000+i*49,f'{i+1}. {t}',22)
 label(s,80,1257,'角色轮廓仅示意。格子、高差和门洞需按实际角色尺寸进行物理验证；当前不作为碰撞数据。',18,'#9db5c2')
 s.append('</svg>');return ''.join(s)
panels=[('section-B.svg','总剖面'),('room-entry-B.svg','① 跑跳与首战'),('room-ecology-B.svg','② 可观察生态'),('room-cargo-B.svg','③ 重货回程')]
for file,title,sub,v in [('room-entry-B.svg','02 / 维修间 · 逐点设计','入口观察 → 首次接敌 → 设备遮挡 → 跳上绕行 → 看见收益',0),('room-ecology-B.svg','05–09 / 排水沟与观察夹层','先看到食物与生物的关系，再选择介入方式',1),('room-cargo-B.svg','13–10 / 吊装间到货运站','轻装能跳捷径，重货有真正连续的地面路线',2)]:
 (OUT/file).write_text(detail(title,sub,v),encoding='utf-8')
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>永蚀 · 灰盒剖面 B · 待审核</title><style>body{margin:0;background:#111b24;color:#dce6eb;font:16px 'Microsoft YaHei',sans-serif}header{position:sticky;top:0;padding:14px 20px;background:#111b24f5;border-bottom:1px solid #526b79;z-index:2}button{padding:10px 18px;margin:4px;background:#293e4b;color:#dce6eb;border:1px solid #526b79;cursor:pointer}button.active{background:#dfc37b;color:#17212a}main{overflow:auto}img{display:block;width:100%;min-width:960px}p{margin:4px 0 10px;color:#a9bdc8}</style><header><p>灰盒剖面 B · 只供地图审核，未接入游戏　｜　选择总图或房间放大图</p>'''
for i,(file,title) in enumerate(panels):html+=f'<button class="tab {"active" if i==0 else ""}" onclick="show(this,\'{file}\')">{title}</button>'
html+='''<button onclick="document.querySelector('img').style.width='1600px'">原尺寸</button><button onclick="document.querySelector('img').style.width='100%'">适应窗口</button></header><main><img src="section-B.svg" alt="固定地图灰盒剖面 B"/></main><script>window.show=function(b,f){document.querySelector('img').src=f;document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');window.scrollTo(0,0)}</script></html>'''
(OUT/'index.html').write_text(html,encoding='utf-8')


