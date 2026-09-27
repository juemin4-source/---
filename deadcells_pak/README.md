# Dead Cells 逆向分析

从 `G:\SteamLibrary\steamapps\common\Dead Cells\res.pak`（2GB，heaps .pak v1）逆向的完整分析。

## 产出

| 文件 | 内容 |
| --- | --- |
| [`map_report.html`](map_report.html) | 可视化报告：房间拓扑分布 + 生物群系 + 11 个房间 SVG 平面图 |
| [`map_design.json`](map_design.json) | 全量统计（2190 房间拓扑/尺寸/生物群系） |
| `res_extracted/` | 解包出的全部 7055 个文件（不入库） |

## 关键结论

- **地图**：2197 个手工 BTMX 房间 + 55 种 roomType + 63 生物群系 + 112 层（level 表）生成器拼装；门=墙体边界 5 格缺口；四门+三门房占 70%；水平门（E/W 86-87%）远多于垂直门
- **美术**：292 个 heaps `BATL` 图集共 351,958 帧 sprite；`_n` 后缀 sheet=同布局换色板；3DS Max Bip001 骨轨（78 个 tracks.json）+ Spine 仅 5 个 Boss 部件
- **管线**：7 砖墙调色板（主砖 88%）+ 对象词表 50 种 + 生物群系自动装饰参数（veg/junk 0-1.0）

## 脚本

| 脚本 | 作用 |
| --- | --- |
| `parse_pak2.py` / `reextract.py` | res.pak 解包 |
| `final.py` | 全量房间拓扑解码（BTMX 格式） |
| `join.py` | data.cdb room 表 × 几何 join |
| `render.py` | 房间 SVG 平面图 + map_report.html |
| `batl_final.py` | BATL 图集全量解析 |
| `craft.py` / `pipeline.py` / `lnk_probe.py` | 房间制作管线解剖 |
