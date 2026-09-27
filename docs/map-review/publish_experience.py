from pathlib import Path
from html import escape
import re

p=Path(__file__).parent
source=(p/'体验设计-C.md').read_text(encoding='utf-8')
parts=re.split(r'^## ',source,flags=re.M)
sections=[]
for i,part in enumerate(parts[1:]):
 title,_,body=part.partition('\n')
 paragraphs=[]
 for para in body.strip().split('\n\n'):
  if para.startswith('- '):
   paragraphs.append('<ul>'+''.join('<li>'+escape(x[2:])+'</li>' for x in para.splitlines())+'</ul>')
  else:
   safe=escape(para)
   if '：' in safe and len(safe.split('：')[0])<16:
    lead,rest=safe.split('：',1);safe='<strong>'+lead+'：</strong>'+rest
   paragraphs.append('<p>'+safe+'</p>')
 sections.append(f'<section id="s{i}"><h2>{escape(title)}</h2>'+''.join(paragraphs)+'</section>')
nav=''.join(f'<a href="#s{i}">{escape(part.splitlines()[0])}</a>' for i,part in enumerate(parts[1:]))
old=p/'index.html'
if not (p/'layout-B.html').exists(): (p/'layout-B.html').write_text(old.read_text(encoding='utf-8'),encoding='utf-8')
page='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>永蚀 · 体验与遭遇设计 C</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:24px}body{margin:0;background:#111a20;color:#d2dce1;font:17px/1.85 'Microsoft YaHei',sans-serif}header{padding:45px 6vw 30px;border-bottom:1px solid #33434c;background:#19262e}header small{color:#cdb680;letter-spacing:2px}h1{font-size:36px;line-height:1.35;margin:15px 0}header p{max-width:1000px;color:#afc2cc}main{display:grid;grid-template-columns:265px minmax(0,900px);gap:50px;max-width:1280px;margin:32px auto;padding:0 24px}nav{position:sticky;top:20px;align-self:start;max-height:90vh;overflow:auto}nav a{display:block;padding:9px 10px;color:#acc1cb;text-decoration:none;font-size:14px;line-height:1.45;border-left:2px solid #33434c}nav a:hover{background:#293e49;color:#f0dfb5;border-color:#d8bd7d}section{padding:15px 0 30px;border-bottom:1px solid #33434c;margin-bottom:26px}h2{font-size:25px;color:#eddbb5;line-height:1.5}strong{color:#eff4f7}li{margin-bottom:12px}a{color:#a4ccd9}.badge{display:inline-block;border:1px solid #647563;border-radius:4px;padding:3px 12px;color:#c5d7bc;font-size:14px}.path{padding:20px;background:#22343e;border-left:3px solid #ccae6e;max-width:1050px}@media(max-width:850px){main{display:block}nav{position:static;max-height:none;display:flex;overflow:auto;margin-bottom:20px}nav a{min-width:170px}h1{font-size:28px}body{font-size:16px}}</style></head><body><header><small>EVER ECLIPSE / ENCOUNTER DESIGN C</small><h1>先决定这一趟经历什么，再画地图</h1><span class="badge">审核稿 · 未接入游戏</span><p>旧 A / B 图不作为施工依据。这里是具体的遭遇、选择、收益与回程变化；八段经历不等于八个房间。</p><div class="path">出门交战 → 看懂生态 → 有依据地选路 → 组合发挥 → 休整与诱惑 → 深入控制层 → 决定搬货 → 熟地回程</div></header><main><nav>'''+nav+'</nav><article>'+''.join(sections)+'''<p><a href="体验设计-C.md">设计原文</a> · <a href="layout-B.html">旧 B 图（仅供对照，不作施工依据）</a></p></article></main></body></html>'''
(p/'index.html').write_text(page,encoding='utf-8')
print('Published',len(sections),'sections; game source unchanged.')
