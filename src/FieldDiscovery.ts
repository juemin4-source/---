import type { ModuleKind } from "./EnemyModule";
import type { ZoneId } from "./ExpeditionMap";
import type { Cargo, Profile } from "./Progression";

export type DiscoveryKind = "memory" | "survivor" | "lift" | "anomaly";
export interface FieldFeature {
  id: string;
  zoneId: ZoneId;
  x: number;
  y: number;
  label: string;
  description: string;
  kind: DiscoveryKind;
  done: boolean;
  recorded: boolean;
  requires?: ModuleKind;
  minActivity?: number;
  duration: number;
}
export interface DiscoveryContext {
  activity: number;
  connected?: readonly ModuleKind[];
  modules?: readonly {
    kind: ModuleKind;
    x: number;
    y: number;
    stable: boolean;
    held?: boolean;
    dead?: boolean;
    parent?: unknown;
  }[];
}
export interface DiscoveryReward {
  cargo: Cargo;
  activity: number;
  message: string;
}

export const discoveryInfo: Record<
  string,
  { name: string; description: string; cityTrace: string }
> = {
  "dawn-lens": {
    name: "晨光透镜",
    description: "一枚仍然温热的旧透镜。镜框内刻着孩子的身高刻度。",
    cityTrace: "研究台上多了一束暖光。",
  },
  roots: {
    name: "耐寒根种",
    description: "封闭暖室里，几株根茎还在低温下生长。",
    cityTrace: "据点的窗边出现了第一盆植物。",
  },
  "outward-scar": {
    name: "反向伤痕",
    description: "这片装甲上的冲击痕朝向设施外侧。先把样本带回去。",
    cityTrace: "研究台挂起了一片有待解释的装甲样本。",
  },
};

/** Per-expedition discoveries only. The host owns proximity, channeling and banking. */
export class FieldDiscovery {
  features: FieldFeature[];
  found: string[] = [];
  escort = false;
  liftOpen = false;

  constructor(profile: Profile, seed: number, sortie: number) {
    const memory = (
      id: string,
      zoneId: ZoneId,
      x: number,
      y: number,
      requires?: ModuleKind,
    ): FieldFeature => ({
      id,
      zoneId,
      x,
      y,
      label: discoveryInfo[id].name,
      description: discoveryInfo[id].description,
      kind: "memory",
      done: false,
      recorded: profile.discoveries?.includes(id) ?? false,
      requires,
      duration: requires ? 2 : 1.4,
    });
    this.features = [
      memory("dawn-lens", "crown", 1730, 1186),
      memory("roots", "nursery", 1730, 946),
      memory("outward-scar", "nest", 1730, 1186),
      {
        id: "dormant-cache",
        zoneId: "crater",
        x: 4400,
        y: 1546,
        label: "休眠匣",
        description:
          "70% 活化时解锁。核心 ×2、数据 ×3；开匣会再增加 12% 活化度。",
        kind: "anomaly",
        done: false,
        recorded: false,
        minActivity: 70,
        duration: 2.4,
      },
    ];
    if (!profile.residents?.includes("engineer")) {
      // Consecutive sorties use opposite branches; seed varies the exact signal.
      const zoneId = sortie % 2 === 1 ? "shelter" : "housing";
      const offset = (((seed >>> 0) % 3) - 1) * 24;
      this.features.push({
        id: "engineer",
        zoneId,
        x: (zoneId === "shelter" ? 1050 : 3600) + offset,
        y: zoneId === "shelter" ? 586 : 1546,
        label: "微弱生命信号 · 工程师",
        description: "接通信标后随你撤离。成功返回，废弃工坊就能重新亮灯。",
        kind: "survivor",
        done: false,
        recorded: false,
        duration: 2,
      });
    }
  }

  available(feature: FieldFeature, context: DiscoveryContext): boolean {
    return this.blockedReason(feature, context) === "";
  }

  blockedReason(feature: FieldFeature, context: DiscoveryContext): string {
    if (!this.features.includes(feature)) return "无法接通信号";
    if (feature.done) return "本次已完成";
    if (
      feature.minActivity !== undefined &&
      context.activity < feature.minActivity
    )
      return `需 ${feature.minActivity}% 活化度 · 当前 ${Math.floor(context.activity)}%`;
    if (feature.requires) {
      const connected = context.connected?.includes(feature.requires);
      const deployed = context.modules?.some(
        (module) =>
          module.kind === feature.requires &&
          !module.dead &&
          !module.parent &&
          module.stable &&
          (module.held ||
            Math.hypot(module.x - feature.x, module.y - feature.y) <= 110),
      );
      if (!connected && !deployed)
        return "暖室卡锁 · 接入牵引腕，或在锁旁定相一只牵引腕";
    }
    return "";
  }

  complete(
    feature: FieldFeature,
    context: DiscoveryContext,
  ): DiscoveryReward | null {
    if (!this.available(feature, context)) return null;
    feature.done = true;
    if (feature.kind === "survivor") {
      this.escort = true;
      return {
        cargo: { material: 0, core: 0, data: 0 },
        activity: 0,
        message: "工程师已接入护送信标 · 成功撤离才能让工坊亮灯",
      };
    }
    if (feature.kind === "lift") {
      this.liftOpen = true;
      return {
        cargo: { material: 0, core: 0, data: 0 },
        activity: 8,
        message: "应急升降梯已接通 · 再按 W 乘梯回安全气闸，抵达后仍需撤离",
      };
    }
    if (feature.kind === "anomaly")
      return {
        cargo: { material: 0, core: 2, data: 3 },
        activity: 12,
        message: "休眠匣已唤醒 · 核心 +2 / 数据 +3 · 活化度 +12%",
      };
    if (!feature.recorded && !this.found.includes(feature.id))
      this.found.push(feature.id);
    return {
      cargo: feature.recorded
        ? { material: 2, core: 0, data: 1 }
        : { material: 0, core: 0, data: 2 },
      activity: feature.requires ? 2 : 0,
      message: feature.recorded
        ? `${feature.label} · 已记录，补充材料 +2 / 数据 +1`
        : `${feature.label}已收好 · 成功带回后会在据点留下痕迹`,
    };
  }
}
