# 黑日计划 · 工作区 monorepo

| 子项目 | 目录 | 状态 |
| --- | --- | --- |
| 永蚀玩法原型 | 仓库根（`src/` + `tests/` + `docs/`） | 开发中（0.11 远征/梯子） |
| PixelBench 资产工作台 | [`art_tools/`](art_tools/PRD-PixelBench.md) | M1 已交付（PR #1），`python art_tools/bench_server.py` 起服务 :8321 |
| Dead Cells 逆向 | [`deadcells_pak/`](deadcells_pak/) | 报告完成：2197 房间 + 35 万帧 sprite 全量解析，`map_report.html` 可视化 |

Git/PR 约定见 [`art_tools/PRD-PixelBench.md`](art_tools/PRD-PixelBench.md#git--pr-工作流)。

---

# 永蚀 / Ever Eclipse · 玩法原型

2D 横版搜打撤动作游戏的浏览器玩法原型。Phaser 3 + TypeScript + Vite，纯前端；画面、粒子、音效全部程序生成，无外部美术资源。

> 本仓库只做**玩法验证**。正式工程（Godot）与完整设计库在 `JueMingObject/EVER-ECLIPSE`；
> 本原型验证通过的规则再迁入正式工程。

**0.9 重点：打击感与狂热。** 顿帧、慢动作、镜头震动、粒子与尸体击飞；连杀进入狂热档位获得攻速/移速/伤害加成；
持续命中可破韧打断敌人起手；敌人残血进入处决线。见 [`docs/01_当前规则/0.9_打击感与狂热.md`](docs/01_当前规则/0.9_打击感与狂热.md)。

## 设计依据

唯一设计权威：[`docs/00_设计依据/永蚀设计概述_用户原文.txt`](docs/00_设计依据/永蚀设计概述_用户原文.txt)（工作台 ID 77）。
与之冲突的内容一律以它为准。

| 目录 | 内容 | 能否作为依据 |
| --- | --- | --- |
| `docs/00_设计依据/` | 项目所有者亲写的设计总纲 | ✅ 唯一权威 |
| `docs/01_当前规则/` | 当前原型已实现规则、公式、验证记录（0.6–0.9） | ✅ 描述现状 |
| `docs/02_历史/` | 0.1–0.5 的迭代记录 | ❌ 仅追溯 |

版本变化见 [`CHANGELOG.md`](CHANGELOG.md)。

## 启动

需要 Node.js 22.12+。

```powershell
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 机制测试（vitest）
npm run check      # 类型检查 + 格式检查 + 测试
npm run build      # 生产构建到 dist/
npm run format     # prettier 格式化
```

浏览器验收与机器人试玩需要先启动 `npm run dev`：

```powershell
node scripts/run-browser.mjs scripts/browser/ascent-browser.js   # 浏览器验收
node scripts/verify-feel.mjs                                    # 打击感验收
node scripts/playtest.mjs 60 unlimited                          # 机器人试玩指标
```

## 战斗手感（0.9）

| 机制 | 效果 |
| --- | --- |
| 顿帧 / 慢动作 | 命中冻结 12ms，重击 70ms，母体击杀 240ms + 0.9 秒慢动作；完美闪避/格挡 0.4 秒慢动作 |
| 镜头 | 震动（trauma 平方衰减）、射击后坐、击杀推近、受击暗角与闪光 |
| 粒子 / 尸体 | 火花、碎块、冲击环；敌人死后被击飞翻滚 |
| 连杀狂热 | 3/7/13/22 杀四档，攻速最高 +48%、移速 +32%、伤害 +60%；受伤扣连杀时间 |
| 破韧 | 持续命中打断敌人起手，硬直期间易伤 +45%，有冷却防锁死 |
| 处决线 | 敌人生命低于 28% 时受到伤害 ×1.6 |

首页入口：

- **无限收集 · 进入沉井**（默认）：28 种模块无上限自动接入，持续增援，难度随收集与时间上升。
- **六槽探索**：对照版本，六个槽位，同类自动叠层、新种类按 E 接入。
- **训练场**：独立数值调试，可配置敌人、波次、掉落、模块与层数。

## 操作

| 输入 | 作用 |
| --- | --- |
| A / D | 移动 |
| Space | 跳跃（短按低跳、长按高跳） |
| S | 穿过单向平台下落 |
| Shift | 冲刺（短暂无敌，可触发完美闪避） |
| F | 空中下砸 |
| 鼠标 / 左键 | 瞄准 / 主武器攻击 |
| 右键 | 盾牌格挡 |
| Q | 投掷 / 部署副武器 |
| 1–5 / 6–9 | 切换主武器 / 副武器 |
| H | 医疗针 |
| E | 交互、开箱、接入；气闸处按住撤离 |
| B | 配装面板（全部模块说明） |
| R | 推荐构筑与追踪 |
| Tab | 剖面地图 |
| Esc | 暂停 |
| M | 静音 |

## 代码结构

```text
src/
  main.ts           启动 Phaser，挂载 SliceScene
  engine/           通用底层：物理、玩家移动、弹丸、敌人实体、渲染、音效
                    （World / OrganRig / ModuleSystems 等保留自早期原型，是 SliceWorld 的基类）
  game/             当前玩法
    SliceScene.ts   输入、固定步长、HUD 与界面
    SliceWorld.ts   战斗、模块叠层、掉落、结算
    Juice.ts        打击感导演：顿帧、慢动作、镜头、粒子、连杀狂热、破韧
    JuiceRender.ts  打击感的绘制与 HUD 片段
    Armory.ts       玩家九种武器
    EnemyCombat.ts  敌人武器与模块
    Ascent*.ts      沉井上行地图与增援
    config.ts       模块 / 武器 / 区域配置
    BuildGuide.ts   推荐构筑
    TrainingUI.ts   训练场面板
  styles/           界面样式
tests/              vitest 机制测试
scripts/browser/    浏览器验收脚本（需先 npm run dev），说明见该目录 README
scripts/run-browser.mjs 运行浏览器验收脚本
scripts/verify-feel.mjs 打击感浏览器验收
scripts/playtest.mjs    机器人试玩，输出击杀/DPS/连杀等指标
art/                美术源文件
output/             本地产物（截图、快照，不入库）
```

## 已知技术债

- `engine/World.ts` 仍带有 0.1–0.4 的器官物理、房间流程逻辑，`SliceWorld` 通过继承复用其中一部分；后续应把当前玩法真正用到的部分下沉、其余删除。
- 界面用 HTML 字符串拼接（`SliceScene` / `TrainingUI` / `BuildGuide`），长模板行较多。
