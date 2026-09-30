/** Authored campaign content. These are prototype rules for details left open in the design. */
export const professions = {
  resident: "居民",
  mechanic: "机械师",
  scientist: "科学家",
  doctor: "医生",
  engineer: "工程师",
  merchant: "商人",
  instructor: "教官",
};
export type Profession = keyof typeof professions;
export const people = {
  lin: { name: "林叔", profession: "mechanic", x: 1430, y: 2176, district: "cargo", age: "中年" },
  an: { name: "安禾", profession: "resident", x: 5160, y: 1656, district: "cool", age: "青年" },
  gu: { name: "顾医生", profession: "doctor", x: 2860, y: 1799, district: "bed", age: "成年" },
  su: { name: "苏研究员", profession: "scientist", x: 4490, y: 1136, district: "deep", age: "老年" },
  tang: { name: "唐工", profession: "engineer", x: 6240, y: 1370, district: "spine", age: "成年" },
  qiao: { name: "乔鸢", profession: "instructor", x: 3460, y: 1656, district: "control", age: "成年" },
  du: { name: "杜宽", profession: "merchant", x: 3580, y: 2176, district: "heatx", age: "成年" },
} as const;
export type PersonId = keyof typeof people;
export const courses = {
  mechanical: { name: "机械维修", book: "maintenanceBook", profession: "mechanic", prerequisite: null },
  medicine: { name: "急救医学", book: "medicalBook", profession: "doctor", prerequisite: null },
  computing: { name: "计算研究", book: "pythonBook", profession: "scientist", prerequisite: null },
  fusion: { name: "能源工程", book: "fusionBook", profession: "engineer", prerequisite: "mechanical" },
} as const;
export const heroes = {
  meng: {
    name: "主角·孟章",
    skill: "回响复演",
    description: "G 开始记录 6 秒内的射击与挥击，再按 G 重演；复制不支付资源，不再次记录。",
  },
  rabbit: {
    name: "房日兔",
    skill: "三昧真火",
    description: "G 开启 8 秒过热输出窗口，超出热量上限的热转化为伤害增益。",
  },
};
export type HeroId = keyof typeof heroes;
export const partners = {
  none: { name: "不带支援", description: "" },
  cheng: { name: "程岳", description: "T 部署一个持续 12 秒的支援炮台" },
  qiao: { name: "乔鸢", description: "T 提高攻速和移速，持续 6 秒" },
  lu: { name: "陆衡", description: "T 放下稳定区域，在区域内减伤减击退" },
  du: { name: "杜宽", description: "T 挂月印，6 秒后恢复期间所受生命伤害的一部分" },
};
export type PartnerId = keyof typeof partners;
export const branches = {
  force: { name: "日·峰值", description: "技能攻击收益提高；与其他分支互斥" },
  flow: { name: "水·流动", description: "技能冷却缩短；与其他分支互斥" },
  growth: { name: "木·生长", description: "技能持续时间延长；与其他分支互斥" },
};
export const weaponRecipes = {
  recoil: { cost: 50, needs: { lithium: 2, bioPart: 1 } },
  nail: { cost: 55, needs: { lithium: 3 } },
  harpoon: { cost: 55, needs: { bioPart: 2 } },
  blade: { cost: 65, needs: { lithium: 2, forgeBlueprint: 1 } },
  gravity: { cost: 75, needs: { neuralSample: 1, lithium: 2 } },
  rift: { cost: 65, needs: { forgeBlueprint: 1, bioPart: 1 } },
  rifle: { cost: 45, needs: { lithium: 2, bioPart: 1 } },
  sniper: { cost: 80, needs: { lithium: 3, forgeBlueprint: 1 } },
  hammer: { cost: 45, needs: { bioPart: 2 } },
  drone: { cost: 70, needs: { lithium: 2, pythonBook: 1 } },
  turret: { cost: 85, needs: { lithium: 3, forgeBlueprint: 1 } },
} as const;
export const constructions = {
  machining: {
    name: "精密加工工坊",
    cost: 90,
    needs: { machineTool: 1 },
    worker: "mechanic",
    description: "安装大型机床，开放第三级武器强化",
  },
  housing: {
    name: "居住区扩建",
    cost: 50,
    needs: { bioPart: 2 },
    worker: "resident",
    description: "安置上限 3 → 8 人",
  },
  refinery: {
    name: "材料提炼台",
    cost: 35,
    needs: { bioPart: 1 },
    worker: "mechanic",
    description: "电池提取锂，反应堆燃料提取超重氢",
  },
  laboratory: {
    name: "器官研究站",
    cost: 60,
    needs: { neuralSample: 1 },
    worker: "scientist",
    description: "研究封装器官，获得永久武器结构接口",
  },
  academy: {
    name: "知识学习室",
    cost: 30,
    needs: { maintenanceBook: 1 },
    worker: "resident",
    description: "居民读书学习，一趟出行后完成课程",
  },
  freightPower: {
    name: "货梯永久供电",
    cost: 100,
    needs: { deuterium: 2 },
    worker: "engineer",
    description: "后续每趟货梯和货运撤离站预先通电",
  },
  maintenanceRoute: {
    name: "维修捷径整修",
    cost: 65,
    needs: { lithium: 3 },
    worker: "mechanic",
    description: "后续每趟维修捷径预先打开",
  },
} as const;
