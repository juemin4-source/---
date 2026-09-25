# 浏览器验收

所有脚本通过 `scripts/run-browser.mjs` 运行，使用本机 Chrome（playwright-core），无需安装额外浏览器。

```powershell
npm run dev                                        # 另开一个终端
node scripts/run-browser.mjs scripts/browser/ascent-browser.js
node scripts/run-browser.mjs scripts/browser/ascent-browser.js six   # 可选：先点某个首页入口
```

第二个参数可选，取值 `none`（默认，停在首页）/ `six` / `unlimited` / `train` / `train-unlimited`。

| 脚本 | 覆盖 |
| --- | --- |
| `ascent-browser.js` | 沉井上行连续地图、镜头跟随、主路可达 |
| `ascent-interactions.js` | 宝箱、开关、升降台、撤离交互 |
| `unlimited-browser.js` | 无限收集自动接入、HUD、增援、暂停、六槽隔离 |
| `slice-training-browser.js` | 训练台配置、波次、武器与敌人参数 |
| `slice-browser-scenarios.js` | 存档、中断恢复、重开、结算等场景链 |

另有两个面向手感的脚本（不在此目录）：

| 脚本 | 用途 |
| --- | --- |
| `scripts/verify-feel.mjs` | 打击感验收：顿帧、慢动作、镜头、粒子、连杀、破韧 |
| `scripts/playtest.mjs` | 机器人试玩：击杀/DPS/连杀/击杀耗时等指标 |

> 这些是机制与手感检查，不是无辅助平衡试玩；也不能替代真人试玩。
