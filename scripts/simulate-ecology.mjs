// Headless ecology simulator. No browser, no Phaser.
// Usage: node scripts/simulate-ecology.mjs <seed> <seconds> [--player|--no-player] [--nurse]
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./scripts/ts-strip-loader.mjs", pathToFileURL("./"));

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const seed = Number(args[0] ?? 1);
const seconds = Number(args[1] ?? 1200);
const withPlayer = !flags.has("--no-player");
const nurse = flags.has("--nurse");

const { Ecology } = await import("../src/game/expedition/Ecology.ts");
const { districts, districtById } = await import("../src/game/expedition/ExpeditionMap.ts");

const eco = new Ecology(seed);
const open = new Set(["freight-power", "spine-door", "sewer-valve"]);
const curve = [];
const step = 0.5;
// A nurse player walks a plausible route so the "player present" case is exercised without input.
let nurseDistrict = 0;
for (let t = 0; t < seconds; t += step) {
  let player = null;
  if (withPlayer) {
    if (nurse && Math.floor(t / 45) !== nurseDistrict) {
      // Advance one district roughly every 45 seconds, looping the map.
      nurseDistrict = Math.floor(t / 45);
    }
    const d = nurse ? districts[nurseDistrict % districts.length] : districts[3];
    player = { x: d.x + d.w / 2, y: d.floor - 24, district: d.id };
  }
  eco.update(step, { player, open });
  if (Math.abs((t / step) % 60) < 0.5) {
    const s = eco.snapshot();
    curve.push({
      t: s.time,
      threat: s.threat,
      alive: s.alive,
      mature: s.mature,
      apex: s.apex,
      remains: s.remains,
    });
  }
}

const snap = eco.snapshot();
const n = (v) => (Number.isFinite(v) ? v : `!!${v}`);
const named = eco.creatures.filter((c) => c.organs.totalLayers >= 3 || c.stage !== "juvenile");
const maxOrgans = eco.creatures
  .slice()
  .sort((a, b) => b.organs.totalLayers - a.organs.totalLayers)
  .slice(0, 8)
  .map((c) => ({
    name: c.name,
    id: c.id,
    stage: c.stage,
    biomass: +c.biomass.toFixed(1),
    organs: c.organs.toJSON(),
    home: c.home,
    district: c.district,
    intent: c.intent,
    alive: c.alive,
    apex: c.isApex,
  }));
const evolved = eco.log.filter((e) => e.event === "enemy_evolve").slice(-10);
const apexLog = eco.log.filter((e) => e.event === "apex_created").map((e) => e.detail);
const absorbs = eco.log.filter((e) => e.event === "enemy_absorb");
const invalid = [snap.threat, snap.biomass, snap.maxBiomass].filter((v) => !Number.isFinite(v));

console.log(
  JSON.stringify(
    {
      seed,
      seconds,
      withPlayer,
      summary: {
        spawned: eco.metrics.creaturesSpawned,
        alive: snap.alive,
        killed: eco.creatures.filter((c) => !c.alive).length,
        consumes: eco.metrics.creatureConsumes,
        creatureVsCreatureKills: eco.metrics.creatureVsCreatureKills,
        starvationDeaths: eco.metrics.starvationDeaths,
        matureCreated: eco.metrics.matureCreated,
        apexCreated: eco.metrics.apexCreated,
        apexAlive: snap.apex,
        remainsCreated: eco.metrics.remainsCreated,
        remainsLeft: snap.remains,
        absorbedOrgans: eco.metrics.absorbedOrgans,
        maxEnemyUniqueOrgans: snap.maxUniqueOrgans,
        maxEnemyOrganLayers: snap.maxOrganLayers,
        maxEnemyBiomass: n(snap.maxBiomass),
        finalThreat: snap.threat,
        peakThreat: +eco.metrics.peakThreat.toFixed(2),
        threatLabel: snap.threatLabel,
        activeNests: snap.activeNests,
        totalOrgansInWorld: snap.layers,
        aliveByNest: Object.fromEntries(
          eco.nests.map((nes) => [
            nes.id,
            {
              state: nes.state,
              biomass: +nes.biomass.toFixed(1),
              alive: eco.alive.filter((c) => c.home === nes.id).length,
              spawned: eco.metrics.spawnedByNest[nes.id] ?? 0,
            },
          ]),
        ),
      },
      districts: snap.districts,
      topBuilds: maxOrgans,
      apexes: eco.alive
        .filter((c) => c.isApex)
        .map((c) => ({
          name: c.name,
          organs: c.organs.toJSON(),
          biomass: +c.biomass.toFixed(1),
          district: c.district,
        })),
      apexHistory: apexLog,
      lastEvolutions: evolved.map((e) => e.detail),
      absorbSamples: absorbs.slice(-6).map((e) => e.detail),
      threatCurve: curve.filter((_, i) => i % 2 === 0),
      invalidNumbers: invalid.length,
      errors: invalid.length ? "NaN/Infinity detected" : null,
    },
    null,
    2,
  ),
);
