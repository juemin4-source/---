/** Source-space measurements. Presentation only; never used for physics. */
// ~54 px standing silhouette against the unchanged 48 px collision body.
export const HERO_ART_SCALE = 60 / 512;
export const HERO_ART_POSES = [
  { name: "待机", rect: [20, 0, 300, 490], pivot: [185, 481], hand: [142, 264] },
  { name: "跑步 A", rect: [390, 20, 375, 465], pivot: [235, 450], hand: [314, 181] },
  { name: "跑步 B", rect: [790, 30, 365, 450], pivot: [235, 425], hand: [298, 180] },
  { name: "起跳", rect: [1180, 0, 335, 395], pivot: [220, 333], hand: [205, 149] },
  { name: "下落", rect: [0, 495, 340, 510], pivot: [210, 490], hand: [284, 251] },
  { name: "冲刺", rect: [350, 580, 440, 375], pivot: [270, 365], hand: [414, 152] },
  { name: "下砸", rect: [800, 490, 340, 505], pivot: [235, 492], hand: [216, 171] },
  { name: "落地", rect: [1180, 650, 355, 325], pivot: [175, 296], hand: [213, 276] },
] as const;

export function heroHandOffset(pose: number, direction: number, squash = 0) {
  const { hand, pivot } = HERO_ART_POSES[pose];
  return {
    x: (hand[0] - pivot[0]) * HERO_ART_SCALE * direction * (1 + squash * 0.35),
    y: (hand[1] - pivot[1]) * HERO_ART_SCALE * (1 - squash * 0.4),
  };
}

export const HERO_ART_PALETTE = ["#e6e9eb", "#a7adb6", "#202128", "#faf0e7", "#a51d46", "#ed477a"];
