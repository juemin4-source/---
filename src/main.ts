import Phaser from "phaser";
import { LevelScene } from "./LevelScene";
import { ExpeditionScene } from "./ExpeditionScene";
import { SliceScene } from "./slice/SliceScene";
import "./style.css";
import "./expedition.css";
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#10181c",
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new URLSearchParams(location.search).has("combat")
    ? LevelScene
    : new URLSearchParams(location.search).has("legacy")
      ? ExpeditionScene
      : SliceScene,
});
