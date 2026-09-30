export const ruleOrgans = {
  returnMembrane: {
    name: "回程膜",
    tag: "弹丸回程",
    color: "#9fdfe0",
    description: "弹丸飞行到期后返回当前位置，可再次命中。每层延长回程 0.25 秒；撞墙仍会阻挡。",
  },
  mirrorEye: {
    name: "镜胎眼",
    tag: "残像枪口",
    color: "#cab4ef",
    description: "冲刺起点留下 1.2 秒残像，下一次攻击从残像复制一次；每层延长 0.2 秒。复制不再次复制。",
  },
  stitch: {
    name: "缝合索",
    tag: "敌人连索",
    color: "#eac59c",
    description: "连续直接攻击不同敌人，将二者连接 5 秒；一方被击退时另一方反向受力。层数延长连接。",
  },
  debt: {
    name: "迟发核",
    tag: "重击收债",
    color: "#edd38c",
    description: "直接伤害的 35% 延后记账，重击结清；每层再延后 5%，最多 70%。",
  },
  vacuum: {
    name: "空泡肺",
    tag: "爆炸吸入",
    color: "#9cd8cb",
    description: "爆炸先吸入 0.3 秒，再结算伤害与推出。每层提升吸力。",
  },
  corpse: {
    name: "尸殖囊",
    tag: "尸体枪口",
    color: "#bfcf91",
    description: "击杀留下持续 4 秒的临时炮体，每层增加 1 秒。最多 12 个；可以继续触发击杀链。",
  },
  parasite: {
    name: "寄生接口",
    tag: "部署附着",
    color: "#c2b5e9",
    description: "部署物附着瞄准方向最近敌人，随宿主移动；宿主死亡后留在原地。层数扩大附着范围。",
  },
  refract: {
    name: "偏折晶状体",
    tag: "折射重击",
    color: "#99d9ff",
    description:
      "弹丸穿过自己的部署物或举盾位置时偏折至最近敌人并成为重击。每弹仅一次；每层提高 5% 折射伤害。",
  },
  polarity: {
    name: "逆极骨",
    tag: "推拉交替",
    color: "#afbcff",
    description: "每次有效击退交替变成推出与牵引；每层增加 10% 牵引强度。",
  },
  shell: {
    name: "蜕壳腺",
    tag: "破盾甲壳",
    color: "#d1e3cf",
    description: "护盾受击耗尽时发射可穿敌的重击甲壳；伤害依据最后吸收量，层数强化。甲壳可被重力泡吸收。",
  },
  split: {
    name: "裂生眼",
    tag: "命中裂生",
    color: "#f1b6a5",
    description:
      "弹丸首次命中或撞墙分裂两枚 45% 威力子弹，最多 2 代；叠层提升至最多 4 代。每帧限制衍生数量。",
  },
  relocate: {
    name: "移巢神经",
    tag: "炮台迁移",
    color: "#d7ce9d",
    description: "重部署炮台保留原炮台生命并迁移到当前位置，触发部署冲击；每层强化冲击。",
  },
} as const;
export const exoticWeapons = {
  recoil: { name: "KSG-09 逆冲霰炮", hint: "七发近距散射；后坐真实推动自身，向下射击可腾空", key: "B" },
  nail: { name: "MRG-04 磁钉枪", hint: "命中墙或敌人留下磁钉，相邻磁钉连线伤敌并牵制宿主", key: "B" },
  harpoon: { name: "HRP-02 捕鲸索", hint: "轻敌拉向自己；重敌和墙面将自己拉过去", key: "B" },
  blade: { name: "RCB-11 回航刃", hint: "去程普通，回程重击，返回你当前的位置", key: "B" },
  gravity: { name: "GRV-3 坍缩囊", hint: "按住维持重力泡吸入敌人与弹丸，松开坍缩", key: "B" },
  rift: { name: "RFT-0 裂隙刀", hint: "挥刀留下持续裂痕；交叉裂痕引发一次爆发", key: "B" },
} as const;
