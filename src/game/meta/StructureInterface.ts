/** Structural families preserve the source organ's theme without carrying run stacks into a new run. */
export function structureInterface(id: string) {
  if (["speed", "glass", "airJump", "perfect", "stunRegen"].includes(id))
    return { damage: 1, speed: 1.06, cooling: 0, description: "轻量动作接口：主武器攻速 +6%" };
  if (["battery", "hot", "coolShield", "vent", "overflow", "vitality", "armor", "leech"].includes(id))
    return { damage: 1, speed: 1, cooling: 0.12, description: "能量循环接口：散热速度 +12%" };
  return { damage: 1.08, speed: 1, cooling: 0, description: "冲击传导接口：主武器基础伤害 +8%" };
}
