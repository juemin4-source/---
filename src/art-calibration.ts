import { HERO_ART_POSES, HERO_ART_SCALE, HERO_ART_PALETTE, heroHandOffset } from "./engine/HeroArtSpec";
import { HERO_RUN_FRAMES, HERO_RUN_SCALE } from "./engine/HeroRunSpec";
const canvas = document.querySelector<HTMLCanvasElement>("#sheet")!;
const ctx = canvas.getContext("2d")!;
const light = document.querySelector<HTMLInputElement>("#light")!;
const guides = document.querySelector<HTMLInputElement>("#guides")!;
const flip = document.querySelector<HTMLButtonElement>("#flip")!;
const image = new Image();
let direction = 1;
function draw() {
  ctx.fillStyle = light.checked ? "#b6c1c9" : "#202630";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [row, zoom] of [1, 3].entries()) {
    HERO_ART_POSES.forEach(({ name, rect, pivot }, i) => {
      const x = 70 + i * 140,
        y = row ? 515 : 155;
      const scale = HERO_ART_SCALE * zoom;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(direction * scale, scale);
      ctx.drawImage(image, rect[0], rect[1], rect[2], rect[3], -pivot[0], -pivot[1], rect[2], rect[3]);
      ctx.restore();
      if (guides.checked) {
        ctx.strokeStyle = "#53d8d0";
        ctx.strokeRect(x - 12.5 * zoom, y - 48 * zoom, 25 * zoom, 48 * zoom);
        ctx.strokeStyle = "#e8bb67";
        ctx.beginPath();
        ctx.moveTo(x - 50, y);
        ctx.lineTo(x + 50, y);
        ctx.stroke();
        ctx.fillStyle = "#ff5179";
        ctx.beginPath();
        ctx.arc(x, y - 24 * zoom, 3, 0, Math.PI * 2);
        ctx.fill();
        const hand = heroHandOffset(i, direction);
        ctx.fillStyle = "#d985ef";
        ctx.beginPath();
        ctx.arc(x + hand.x * zoom, y + hand.y * zoom, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = light.checked ? "#202630" : "#ece9e7";
      ctx.textAlign = "center";
      ctx.font = "14px system-ui";
      ctx.fillText(`${i} · ${name}`, x, y + 32);
    });
  }
}
flip.onclick = () => {
  direction *= -1;
  flip.textContent = direction > 0 ? "朝向：右 →" : "朝向：← 左";
  draw();
};
light.onchange = guides.onchange = draw;
image.onload = draw;
image.src = new URL("./assets/hero-actions-v1.png", import.meta.url).href;
document.querySelector("#palette")!.innerHTML = HERO_ART_PALETTE.map(
  (color) => `<span style="--color:${color}">${color}</span>`,
).join("");

const motion = document.querySelector<HTMLCanvasElement>("#motion")!;
const mc = motion.getContext("2d")!;
const play = document.querySelector<HTMLButtonElement>("#play")!;
const aim = document.querySelector<HTMLInputElement>("#aim")!;
const runMode = document.querySelector<HTMLInputElement>("#run-mode")!;
const runImage = new Image();
runImage.src = new URL("./assets/hero-run-v3.png", import.meta.url).href;
let playing = false,
  pose = 0,
  lastStep = 0;
play.onclick = () => {
  playing = !playing;
  play.textContent = playing ? "暂停" : "播放八姿态";
  lastStep = performance.now();
};
document.querySelector<HTMLButtonElement>("#step")!.onclick = () => {
  playing = false;
  play.textContent = "播放八姿态";
  pose = (pose + 1) % 8;
};
function animate(now: number) {
  if (playing && now - lastStep > (runMode.checked ? 95 : 220)) {
    pose = (pose + 1) % 8;
    lastStep = now;
  }
  mc.fillStyle = light.checked ? "#b6c1c9" : "#202630";
  mc.fillRect(0, 0, 1120, 300);
  if (image.complete && image.naturalWidth) {
    const useRun = runMode.checked && runImage.complete && runImage.naturalWidth > 0;
    const { rect, pivot } = useRun ? HERO_RUN_FRAMES[pose] : HERO_ART_POSES[pose];
    const name = useRun ? `跑步循环 ${pose + 1}` : HERO_ART_POSES[pose].name;
    for (const [x, zoom] of [
      [240, 1],
      [750, 3],
    ]) {
      const y = 245,
        s = (useRun ? HERO_RUN_SCALE : HERO_ART_SCALE) * zoom;
      mc.save();
      mc.translate(x, y);
      mc.scale(s * direction, s);
      mc.drawImage(
        useRun ? runImage : image,
        rect[0],
        rect[1],
        rect[2],
        rect[3],
        -pivot[0],
        -pivot[1],
        rect[2],
        rect[3],
      );
      mc.restore();
      const hand = useRun
        ? {
            x: (HERO_RUN_FRAMES[pose].hand[0] - pivot[0]) * HERO_RUN_SCALE * direction,
            y: (HERO_RUN_FRAMES[pose].hand[1] - pivot[1]) * HERO_RUN_SCALE,
          }
        : heroHandOffset(pose, direction);
      mc.save();
      mc.translate(x + hand.x * zoom, y + hand.y * zoom);
      mc.rotate((Number(aim.value) * Math.PI) / 180);
      mc.scale(zoom, zoom);
      mc.fillStyle = "#171a24";
      mc.fillRect(0, -5, 20, 9);
      mc.fillStyle = "#a51d46";
      mc.fillRect(3, -3, 7, 3);
      mc.restore();
      if (guides.checked) {
        mc.strokeStyle = "#53d8d0";
        mc.strokeRect(x - 12.5 * zoom, y - 48 * zoom, 25 * zoom, 48 * zoom);
        mc.strokeStyle = "#e8bb67";
        mc.beginPath();
        mc.moveTo(x - 100, y);
        mc.lineTo(x + 100, y);
        mc.stroke();
      }
    }
    mc.fillStyle = light.checked ? "#202630" : "#ece9e7";
    mc.font = "18px system-ui";
    mc.fillText(`${pose} · ${name}`, 30, 35);
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
