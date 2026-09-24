import type { EnemyKind } from "../Enemy";
import type { Rect } from "../PhysicsHelpers";

export const organs = {
  ram: { name: "冲撞腺", tag: "动作改造", color: "#edb76c", description: "冲刺接触敌人时造成 12 伤害，并将它向冲刺方向击退。每次冲刺每个目标只触发一次。" },
  battery: { name: "压电骨", tag: "撞墙 → 充能", color: "#edb76c", description: "被你击退的敌人撞到实体墙或边界：获得 1 点充能（上限 3），并眩晕 0.8 秒。同一敌人间隔 0.9 秒。" },
  discharge: { name: "放电髓", tag: "充能 → 重击", color: "#edb76c", description: "任何武器的重击有充能时消耗 1 点，每层增加 32 直接伤害和 35 范围放电伤害。匕首没有重击。" },
  mark: { name: "刻印眼", tag: "三击 → 印记", color: "#b7a4ed", description: "直接射击同一敌人累计命中三次，施加持续 8 秒的印记。传导和爆炸不累积次数。" },
  conduit: { name: "共鸣索", tag: "印记 → 传导", color: "#b7a4ed", description: "子弹直接命中带印记敌人，将本次伤害的 60% 传给 320 距离内其他带印记敌人。传导不会再次传导。" },
  spread: { name: "播种囊", tag: "死亡 → 传播", color: "#b7a4ed", description: "带印记敌人死亡，将印记传播给 280 距离内其他敌人，持续 8 秒。先标记一个目标，再集中击杀。" },
  speed: { name: "疾搏心", tag: "攻速 +25%", color: "#9cd8cb", description: "每层提高 25% 攻击速度，影响枪械、近战和召唤物；匕首节拍最多加速到两倍。" },
  leech: { name: "回生膜", tag: "击杀 → 治疗", color: "#9cd8cb", description: "每层增加 10 生命上限，击杀敌人每层恢复 5 生命。搭配蓄生囊可把溢出治疗转为护盾。" },
  knock: { name: "增压筋", tag: "击退 +65%", color: "#9cd8cb", description: "冲刺、手雷和射击产生的击退提高 65%。更容易撞墙，也可能把目标推离群体。" },
  glass: { name: "裂心瓣", tag: "生命换攻速", color: "#f08e91", description: "最大生命乘以 0.7 的层数次方（最低 10）；每层攻速 +40%。取下不补回生命。" },
  heavyArea: { name: "震荡肺", tag: "重击 → 范围", color: "#edb76c", description: "重击命中产生 35% 本次伤害的范围冲击；每层半径 +35、伤害比例 +15%（首层 35%）。" },
  shieldBurst: { name: "燃盾囊", tag: "护盾换爆发", color: "#91d5f1", description: "有护盾时每层伤害 +50%，但护盾每秒额外消耗 12 × 层数。" },
  perfect: { name: "瞬息核", tag: "完美闪避 → 充能", color: "#edb76c", description: "冲刺无敌期间躲过一次实际命中，每层获得 1 充能；每次冲刺触发一次。" },
  stunRegen: { name: "回流腱", tag: "眩晕 → 体力", color: "#9cd8cb", description: "把未眩晕敌人打入眩晕时，每层恢复 12 体力。" },
  airJump: { name: "浮游鳍", tag: "空杀 → 凌空跳", color: "#9cd8cb", description: "空中击杀得到凌空跳次数，储存上限等于层数；空中按 Space 消耗一次。" },
  hot: { name: "灼心腺", tag: "高热增伤", color: "#f08e91", description: "热量达到 60 时，每层直接攻击伤害 +35%。" },
  fullRange: { name: "张力筋", tag: "满体力扩域", color: "#9cd8cb", description: "体力至少 95 时，每层近战范围与范围攻击半径 +30%。" },
  coolShield: { name: "冷凝膜", tag: "散热 → 护盾", color: "#91d5f1", description: "热量曾达到 60，冷却至 35 以下时，每层获得 25 护盾。" },
  rage: { name: "痛觉腺", tag: "失血增伤", color: "#f08e91", description: "每损失 1% 最大生命，直接攻击伤害每层增加 0.8%。" },
  vent: { name: "泄压阀", tag: "印记重击 → 散热", color: "#91d5f1", description: "重击命中有印记敌人，消耗印记并降低 25 × 层数热量。" },
  freeze: { name: "凝霜髓", tag: "连续命中 → 冻结", color: "#91d5f1", description: "直接攻击每次积累等于层数的冻结值，满 5 冻结 1.5 秒；每多一层冻结延长 0.25 秒。" },
  stunKnock: { name: "崩解筋", tag: "眩晕 → 强击退", color: "#edb76c", description: "攻击已眩晕目标时，击退额外提高 100% × 层数。" },
  vulnerable: { name: "裂隙牙", tag: "重击 → 易伤", color: "#f08e91", description: "重击使目标易伤 4 秒；后续伤害每层提高 20%。" },
  shatter: { name: "碎晶核", tag: "冻结重击 → 碎冰", color: "#91d5f1", description: "重击冻结敌人消耗冻结，造成每层 45 范围伤害；首层半径 170，每层额外 +30。" },
  overflow: { name: "蓄生囊", tag: "溢出治疗 → 护盾", color: "#91d5f1", description: "超过生命上限的治疗按 100% × 层数转成护盾。与击杀回血联动。" },
  airPower: { name: "天穹翼", tag: "凌空增幅", color: "#9cd8cb", description: "在空中时，每层直接伤害 +30%，攻击范围 +20%。" },
  slam: { name: "坠星骨", tag: "高度 → 下砸", color: "#edb76c", description: "空中按 F 下砸；每层将下坠高度转化为额外范围、伤害和击退。" },
  multi: { name: "群猎眼", tag: "多目标增伤", color: "#b7a4ed", description: "一次近战、穿透射击或爆炸命中多个目标时，每个额外目标使伤害每层提高 15%。" },
} as const;
export type OrganId = keyof typeof organs;
export const organIds = Object.keys(organs) as OrganId[];
export const weapons = {
  handgun: { name: "HCP-05 手炮", hint: "按住连续射击，每第五发为重击", key: "1" },
  rifle: { name: "AR-H7 热负荷步枪", hint: "持续射击积热；高热每发重击；过热锁定至冷却", key: "2" },
  sniper: { name: "SR-P3 贯穿狙击枪", hint: "点按普通弹；按住蓄力，松开贯穿重击", key: "3" },
  dagger: { name: "CQC-R4 节律匕首", hint: "跟随节奏点按；正确 +20% 伤害，最高 +300%；没有重击", key: "4" },
  hammer: { name: "HM-03 重锤", hint: "三连段，第三段范围重击；攻击消耗体力", key: "5" },
} as const;
export type WeaponId = keyof typeof weapons;
export const secondaries = {
  shield: { name: "DS-60 复合防卫盾", hint: "按住右键格挡，减伤 60%；前 0.18 秒完美格挡", key: "6" },
  grenade: { name: "IG-02 冲击手雷", hint: "按住 Q 蓄力，松开投掷；撞击或延时爆炸", key: "7" },
  drone: { name: "UAV-08 伴随无人机", hint: "Q 部署，最多 3 架，总储备 8 架，会被打坏", key: "8" },
  turret: { name: "SGT-01 自动哨戒炮", hint: "Q 放置，最多 1 座，再次部署替换旧炮台", key: "9" },
} as const;
export type SecondaryId = keyof typeof secondaries;
export const builds: Record<string, { name: string; ids: OrganId[]; weapon: WeaponId; secondary: SecondaryId }> = {
  wall: { name: "撞墙放电", ids: ["ram", "battery", "discharge", "knock", "stunRegen", "heavyArea"], weapon: "hammer", secondary: "grenade" },
  mark: { name: "印记连锁", ids: ["mark", "conduit", "spread", "speed", "leech", "multi"], weapon: "handgun", secondary: "drone" },
  ice: { name: "冻结碎冰", ids: ["freeze", "shatter", "heavyArea", "vulnerable", "stunRegen", "speed"], weapon: "hammer", secondary: "turret" },
  heat: { name: "高热循环", ids: ["hot", "coolShield", "shieldBurst", "mark", "vent", "rage"], weapon: "rifle", secondary: "shield" },
  shield: { name: "回生燃盾", ids: ["leech", "overflow", "shieldBurst", "speed", "glass", "vulnerable"], weapon: "sniper", secondary: "drone" },
  air: { name: "凌空猎杀", ids: ["airJump", "airPower", "slam", "multi", "fullRange", "leech"], weapon: "dagger", secondary: "grenade" },
};
export interface Portal { x: number; to: string; label: string; shortcut?: boolean }
export interface Spawn { kind: EnemyKind; x: number; organ: OrganId; y?: number }
export interface Zone {
  name: string; subtitle: string; risk: number; hint: string;
  portals: Portal[]; spawns: Spawn[]; platforms: Rect[];
  chest?: { x: number; value: number; relay?: boolean; name: string };
}
const floor: Rect = { x: 640, y: 665, w: 1280, h: 110 };
const wall = (x: number): Rect => ({ x, y: 577, w: 38, h: 66 });
const ledge = (x: number): Rect => ({ x, y: 520, w: 175, h: 16, oneWay: true });
export const zones: Record<string, Zone> = {
  arena: { name: "无尽猎场", subtitle: "训练 / 持续增压", risk: 3, hint: "B 打开训练台：选择怪物、武器、器官和叠层；击杀后继续刷怪。", portals: [], spawns: [], platforms: [floor, wall(405), wall(915), ledge(660)] },
  hub: { name: "边境气闸", subtitle: "00 / 安全边界", risk: 0, hint: "走近门按 E 出发。任何时候都可以回到气闸撤离。",
    portals: [{ x: 475, to: "west", label: "西 · 冲撞腺 / 压电骨" }, { x: 870, to: "east", label: "东 · 刻印眼 / 共鸣索" }, { x: 1140, to: "junction", label: "已修复运输捷径", shortcut: true }], spawns: [], platforms: [floor] },
  west: { name: "压电采掘场", subtitle: "01 / 西线 · 空间与充能", risk: 1, hint: "金色携带者：先拿冲撞腺，再把敌人推向墙壁。Q 手雷也能击退。",
    portals: [{ x: 75, to: "hub", label: "返回气闸" }, { x: 1190, to: "forge", label: "深入 · 放电髓 / 裂心瓣" }],
    spawns: [{ kind: "crawler", x: 430, organ: "ram" }, { kind: "reclaimer", x: 725, organ: "battery" }, { kind: "crawler", x: 1050, organ: "knock" }], platforms: [floor, wall(850), ledge(520)], chest: { x: 1010, value: 35, name: "旧电池箱" } },
  east: { name: "回声培养廊", subtitle: "02 / 东线 · 印记与传播", risk: 1, hint: "紫色携带者：连续命中三次留下印记。群体战中尝试切换目标。",
    portals: [{ x: 75, to: "hub", label: "返回气闸" }, { x: 1190, to: "choir", label: "深入 · 播种囊 / 疾搏心" }],
    spawns: [{ kind: "crawler", x: 435, organ: "mark" }, { kind: "floater", x: 785, y: 465, organ: "conduit" }, { kind: "crawler", x: 1030, organ: "leech" }], platforms: [floor, ledge(580)], chest: { x: 1010, value: 35, name: "神经样本柜" } },
  forge: { name: "废弃锻造井", subtitle: "03 / 西线深层", risk: 2, hint: "放电髓消耗充能强化第五发。上方平台可以跨过矮墙；S 下落。",
    portals: [{ x: 75, to: "west", label: "退回采掘场" }, { x: 1190, to: "junction", label: "前往运输枢纽" }],
    spawns: [{ kind: "reclaimer", x: 445, organ: "discharge" }, { kind: "floater", x: 750, y: 450, organ: "glass" }, { kind: "crawler", x: 995, organ: "battery" }, { kind: "crawler", x: 1080, organ: "speed" }], platforms: [floor, wall(580), wall(950), ledge(770)], chest: { x: 1080, value: 70, name: "压电样本箱" } },
  choir: { name: "菌群共鸣室", subtitle: "04 / 东线深层", risk: 2, hint: "优先击杀带印记目标，再让传导沿着群体扩散。留意射击预警。",
    portals: [{ x: 75, to: "east", label: "退回培养廊" }, { x: 1190, to: "junction", label: "前往运输枢纽" }],
    spawns: [{ kind: "crawler", x: 435, organ: "spread" }, { kind: "crawler", x: 690, organ: "speed" }, { kind: "floater", x: 875, y: 455, organ: "conduit" }, { kind: "reclaimer", x: 1060, organ: "leech" }], platforms: [floor, ledge(565), ledge(915)], chest: { x: 1050, value: 70, name: "共鸣样本箱" } },
  junction: { name: "失联运输枢纽", subtitle: "05 / 交汇 · 撤还是继续", risk: 2, hint: "这里的回路图带回后可修复永久捷径。已经有收获了，也可以继续挑战母体。",
    portals: [{ x: 75, to: "forge", label: "西线返回" }, { x: 330, to: "choir", label: "东线返回" }, { x: 1170, to: "core", label: "危险 · 母体 / 核心样本 +180" }, { x: 585, to: "hub", label: "运输捷径回气闸", shortcut: true }],
    spawns: [{ kind: "reclaimer", x: 765, organ: "knock" }, { kind: "floater", x: 1000, y: 445, organ: "glass" }], platforms: [floor, wall(900)], chest: { x: 1010, value: 90, relay: true, name: "运输回路图" } },
  core: { name: "永蚀母巢", subtitle: "06 / 可选高风险目标", risk: 3, hint: "母体蓄力后冲锋；红色瞄准线出现时准备闪避。入口随时可以退回。",
    portals: [{ x: 75, to: "junction", label: "撤回运输枢纽" }],
    spawns: [{ kind: "elite", x: 850, organ: "discharge" }, { kind: "crawler", x: 610, organ: "mark" }, { kind: "floater", x: 1070, y: 445, organ: "leech" }], platforms: [floor, ledge(440), ledge(1060)] },
};
