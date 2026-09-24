import Phaser from "phaser";
import { SliceScene } from "./game/SliceScene";
import "./styles/base.css";
import "./styles/panels.css";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#10181c",
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: SliceScene,
});
