from pathlib import Path
from html import escape

out = Path(__file__).parent
s = ['''<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1540" viewBox="0 0 1800 1540">
<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#202d39" stroke-width="1"/></pattern>
<marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#dcba72"/></marker></defs>
<style>text{font-family:'Microsoft YaHei',sans-serif;fill:#dce5ec} .title{font-size:23px;font-weight:700}.small{font-size:15px}.room{font-size:19px;font-weight:700}.sub{font-size:14px;fill:#a9bac6}.note{font-size:18px}.tag{font-size:14px;font-weight:700}</style>
<rect width="1800" height="1540" fill="#101922"/><rect x="35" y="135" width="1270" height="1310" fill="url(#grid)" stroke="#344552"/>
<text x="45" y="53" font-size="32" font-weight="700">永蚀 · 九号泵站迷宫草图 A</text>
<text x="45" y="88" font-size="18" fill="#b6c7d3">供确认的关卡剖面 · 从下往上探索 · 先确定空间与内容，再落地碰撞和美术</text>
<text x="45" y="119" class="small">浅色区域可通行 / 深色是实体建筑　｜　概念布局，非像素施工图；通道画宽仅为阅读方便</text>''']

def text(x,y,t,cls='small',color=None):
    s.append(f'<text x="{x}" y="{y}" class="{cls}"'+(f' style="fill:{color}"' if color else '')+f'>{escape(t)}</text>')

# Authored irregular room footprints, with explicit solid gaps between floors.
rooms = [
 ('01','底部气闸',540,1280,210,100,'出发 / 稳定撤离','safe'),
 ('02','入站维修间',500,1080,270,145,'首战 · 低风险器官',''),
 ('03','旧值班室',245,1080,190,110,'书籍 / 医疗 · 休整','safe'),
 ('04','分拣车间',875,1080,310,125,'具体零件 / 第一处分支',''),
 ('05','排水沟',80,855,295,155,'食腐幼体 · 尸骸聚集','eco'),
 ('06','主泵厅',465,825,320,170,'战斗核心 · 上下两条路径',''),
 ('07','仓储栈道',905,830,290,145,'工业猎手 / 可见高处宝箱','eco'),
 ('08','滤水机房',90,615,255,145,'绕机械掩体 / 可观察进食',''),
 ('09','观察夹层',470,610,300,120,'隔窗观察 · 短暂停歇','safe'),
 ('10','货运站',1025,610,215,130,'供电后撤离 / 接收重货','safe'),
 ('11','旧生体温床',70,395,270,155,'争食区 · 猎手与幼体相遇','eco'),
 ('12','中央换热室',465,385,300,145,'精英交汇 / 多掩体战斗',''),
 ('13','设备吊装间',915,385,300,145,'大型设备 / 货运路线起点',''),
 ('14','封存资料库',140,175,245,130,'书籍 · 蓝图 · 可选支路',''),
 ('15','反应堆外环',495,170,305,130,'高收益 / 神造浮游巢','eco'),
 ('16','上层控制室',955,170,260,130,'电力开关 / 稀有核心',''),
]
# Continuous corridors, not graph edges. Alternate rises use short staggered ledges.
corridors = [
 ('M645 1280 V1240 H725 V1210 H625 V1220 V1225 H600 V1220 V1220 V1220 V1220', 'jump'),
 ('M600 1240 V1225 H540 V1180','jump'),
 ('M500 1145 H435','walk'),('M770 1160 H875','walk'),
 ('M245 1115 H205 V1035 H300 V990','jump'),
 ('M670 1080 V1040 H730 V990','jump'),
 ('M375 940 H465','walk'),
 ('M785 925 H905','walk'),
 ('M1120 1080 V1020 H1035 V975','jump'),
 ('M155 855 V810 H285 V760','jump'),
 ('M620 825 V775 H720 V730','jump'),
 ('M345 690 H470','walk'),
 ('M1195 880 H1260 V670 H1240','lift'),
 ('M1070 830 V780 H1160 V740','jump'),
 ('M770 670 H850 V495 H915','jump'),
 ('M200 615 V575 H290 V550','jump'),
 ('M340 475 H465','walk'),
 ('M625 610 V570 H720 V530','jump'),
 ('M765 475 H915','walk'),
 ('M1060 530 H990 V565 H1110 V600 H1130 V610','cargo'),
 ('M190 395 V350 H295 V305','jump'),
 ('M640 385 V340 H740 V300','jump'),
 ('M1060 385 V350 H1150 V300','jump'),
 ('M385 240 H495','walk'),('M800 240 H955','walk'),
 ('M140 230 H55 V680 H90','ladder'),
]
# Fix entrance path into a clean staggered climb, with overlap to next corridor.
corridors[0]=('M645 1280 V1250 H725 V1210 H600 V1180','jump')
corridors.pop(1)
for d,k in corridors:
    s.append(f'<path d="{d}" stroke="#8a9ba8" stroke-width="38" fill="none" stroke-linejoin="round"/>')
    s.append(f'<path d="{d}" stroke="#283e4b" stroke-width="30" fill="none" stroke-linejoin="round"/>')
for ident,name,x,y,w,h,sub,kind in rooms:
    col = {'safe':'#263f43','eco':'#403b40'}.get(kind,'#2b3c49')
    s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{col}" stroke="#a4b4be" stroke-width="3"/>')
    text(x+14,y+29,f'{ident}  {name}','room')
    text(x+14,y+54,sub,'sub')
    if kind=='eco':
        s.append(f'<circle cx="{x+w-27}" cy="{y+h-28}" r="13" fill="#d1847e"/>')
        text(x+14,y+h-20,'巢 / 食物区','tag','#e4aaa3')
    elif kind=='safe':
        s.append(f'<rect x="{x+17}" y="{y+h-35}" width="13" height="17" fill="#91c4ae"/>')
    else:
        s.append(f'<path d="M{x+18} {y+h-18}h55v-22h45v-20h45" fill="none" stroke="#718b9c" stroke-width="7"/>')

# Local affordances / explicit shortcut doors.
for x,y,label in [(418,1145,'A'),(825,925,'B'),(843,553,'C')]:
    s.append(f'<path d="M{x} {y-21}V{y+21}" stroke="#dcbc78" stroke-width="7"/>')
    text(x-8,y-30,label,'room','#e6c47d')
text(354,1205,'A：从排水沟侧开门','small','#e6c47d')
text(784,988,'B：从仓储侧开门','small','#e6c47d')
text(820,589,'C：吊装间侧打开','small','#e6c47d')
text(1055,794,'跳跃错层','small')
text(1205,790,'货梯','small','#8fd0bb')
s.append('<path d="M1260 700V850" fill="none" stroke="#8fd0bb" stroke-width="5" stroke-dasharray="8 5"/>')
s.append('<path d="M55 300V580" fill="none" stroke="#c4b2db" stroke-width="4" stroke-dasharray="5 6"/>')
text(70,587,'唯一维修梯 · 可选返回路','small','#c4b2db')
# Bulky cargo can descend from the rig to freight using shallow steps, no climbing.
s.append('<path d="M1190 510H985V565H1110V620" fill="none" stroke="#8fd0bb" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#arrow)"/>')
text(920,555,'重货缓阶下行 → 货运站','small','#8fd0bb')
# Observation window between balcony and pump.
s.append('<path d="M492 729H593" stroke="#80b9d1" stroke-width="6" stroke-dasharray="10 4"/>')
text(472,760,'隔窗看到下方争食','small','#8fbfd3')
# Chest / specimen and room-local monster routes.
for x,y,label in [(1140,900,'宝箱兽'),(715,258,'星骸'),(320,263,'蓝图'),(1130,485,'大型设备')]:
    s.append(f'<path d="M{x} {y-10}l10 10l-10 10l-10-10z" fill="#e2c17d"/>')
    text(x-30,y+30,label,'small','#e2c17d')
for d in ['M125 972 Q215 925 335 980','M112 520 Q210 455 300 515','M500 970 Q610 875 760 965','M940 949 Q1050 870 1150 943']:
    s.append(f'<path d="{d}" fill="none" stroke="#ce8d86" stroke-width="2" stroke-dasharray="5 5"/>')

text(1340,171,'先看这四件事','title')
notes=[
('01  规模与方向',['16 个主要空间，三层横向展开。','总体向上深入，局部允许下探。','目标约 8–10 屏宽、5–6 屏高；','实际尺寸按镜头与跳跃再校准。']),
('02  走路、跳跃为主',['普通门洞直接跑过；短高差用跳。','折返通道内是楼梯或错层落脚点，','不是每段竖线都配一根梯子。','三处回环门 A / B / C 从远侧打开。']),
('03  三条探索回环',['下环：维修间→排水沟→主泵厅','→仓储→分拣→维修间。','中环：主泵厅→滤水→温床','→换热→观察夹层→主泵厅。','右环：仓储→货运→吊装','→观察夹层→主泵厅→仓储。']),
('04  危险能提前看见',['排水沟：幼体在吃可见尸骸。','温床：猎手进入幼体食物区。','仓储：工业猎手巡逻守住货物。','外环：浮游群占据高处。','红虚线＝局部活动示意；不穿墙。']),
('资源与回程',['出生点、值班室、观察夹层留喘息。','大型设备只放在能搬出去的吊装间，','经缓阶下行到货运站，无须爬梯。','上层控制室恢复货运撤离供电。','资料库是可选支路，回报书籍蓝图。']),
('这张图尚未决定',['房间内精确跳台、伤害与掉落数值，','以及生态进食和争斗的发生频率。','先审核：房间分布、路线、规模、','探索目标和回程是否符合你的想象。'])]
y=210
for title,lines in notes:
    text(1340,y,title,'room','#e1c48a'); y+=29
    for line in lines: text(1340,y,line,'note'); y+=27
    y+=25
text(65,1420,'起点 ↑　先进入维修间交战，再决定：左边搜旧设施 / 右边走货运线 / 向上进主泵厅','note')
text(45,1500,'草案 A · 仅供布局审核，尚未接入游戏。关卡必须让地形、敌人活动和物资运输共同成立。','note','#a4b9c8')
s.append('</svg>')
svg=''.join(s)
(out/'pump-station-maze-A.svg').write_text(svg,encoding='utf-8')
(out/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>永蚀地图草案 A · 待确认</title><style>body{margin:0;background:#101922;color:#ddd;font:16px "Microsoft YaHei"}header{position:sticky;top:0;background:#101922ee;padding:12px 24px}button{padding:8px 16px;margin-right:10px;cursor:pointer;background:#2b3c49;color:#fff;border:1px solid #718b9c}main{overflow:auto}svg{display:block;min-width:1000px;width:100%;height:auto}</style><header>地图审核 · 滚动查看　<button onclick="document.querySelector('svg').style.width='1800px'">原尺寸</button><button onclick="document.querySelector('svg').style.width='100%'">适应窗口</button>尚未接入游戏</header><main>'''+svg+'</main></html>',encoding='utf-8')
