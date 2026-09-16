import { invoke } from "@tauri-apps/api/core";
import "./style.css";

const FRAME_MS = 180;
const MOVE_STEP = 12;
const MOOD_DELAY_MIN = 6_000;
const MOOD_DELAY_MAX = 12_000;
const ALPHA_THRESHOLD = 8;
const moodNames = ["mood1", "mood2"];
const moods = { mood1: [], mood2: [] };
const frameModules = import.meta.glob(
  "./assets/{mood1,mood2}/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,gif,GIF,avif,AVIF}",
  { eager: true, query: "?url", import: "default" },
);
const sorter = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

for (const [path, url] of Object.entries(frameModules)) {
  const mood = path.split("/").at(-2);
  moods[mood]?.push({ path, url });
}

for (const frames of Object.values(moods)) {
  frames.sort((a, b) => sorter.compare(a.path, b.path));
}

const pet = document.querySelector("#pet");
const context = pet.getContext("2d", { willReadFrequently: true });
let currentMood = moodNames[Math.floor(Math.random() * moodNames.length)];
let frameIndex = 0;
let timerId;
let moodTimerId;
let rendering = false;

function loadImage(url) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

async function prepareFrames() {
  const frames = Object.values(moods).flat();
  await Promise.all(
    frames.map(async (frame) => {
      frame.image = await loadImage(frame.url);
    }),
  );
}

function drawImage(image) {
  const scale = Math.min(pet.width / image.width, pet.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (pet.width - width) / 2;
  const y = (pet.height - height) / 2;

  context.clearRect(0, 0, pet.width, pet.height);
  context.drawImage(image, x, y, width, height);
}

function createHitRects() {
  const pixels = context.getImageData(0, 0, pet.width, pet.height).data;
  const rects = [];
  let active = new Map();

  for (let y = 0; y < pet.height; y += 1) {
    const runs = [];
    let start = -1;

    for (let x = 0; x <= pet.width; x += 1) {
      const opaque =
        x < pet.width && pixels[(y * pet.width + x) * 4 + 3] >= ALPHA_THRESHOLD;

      if (opaque && start < 0) start = x;
      if (!opaque && start >= 0) {
        runs.push([start, x]);
        start = -1;
      }
    }

    const next = new Map();
    for (const [left, right] of runs) {
      const key = `${left}:${right}`;
      const rect = active.get(key) ?? [left, y, right, y + 1];
      rect[3] = y + 1;
      next.set(key, rect);
    }

    for (const [key, rect] of active) {
      if (!next.has(key)) rects.push(rect);
    }
    active = next;
  }

  rects.push(...active.values());
  return rects;
}

async function showFrame() {
  if (rendering) return;
  const frames = moods[currentMood];
  if (!frames.length) return;

  rendering = true;
  try {
    const frame = frames[frameIndex];
    frameIndex = (frameIndex + 1) % frames.length;
    drawImage(frame.image);
    frame.hitRects ??= createHitRects();
    await invoke("set_hit_regions", { rects: frame.hitRects });
  } finally {
    rendering = false;
  }
}

function switchMood(mood) {
  if (!moods[mood]?.length) return;

  currentMood = mood;
  frameIndex = 0;
  showFrame().catch(console.error);
  scheduleMoodChange();
}

function scheduleMoodChange() {
  window.clearTimeout(moodTimerId);
  const delay =
    MOOD_DELAY_MIN + Math.random() * (MOOD_DELAY_MAX - MOOD_DELAY_MIN);
  const nextMood = moodNames.find((mood) => mood !== currentMood);

  moodTimerId = window.setTimeout(() => switchMood(nextMood), delay);
}

function movePet(key) {
  const offsets = {
    ArrowLeft: [-MOVE_STEP, 0],
    ArrowRight: [MOVE_STEP, 0],
    ArrowUp: [0, -MOVE_STEP],
    ArrowDown: [0, MOVE_STEP],
  };
  const [dx, dy] = offsets[key];
  return invoke("move_pet", { dx, dy });
}

async function start() {
  if (!moods.mood1.length || !moods.mood2.length) {
    console.error("Image frames are required in both mood folders.");
    return;
  }

  if (!context) throw new Error("Canvas is not supported.");
  pet.width = window.innerWidth;
  pet.height = window.innerHeight;
  await prepareFrames();
  await showFrame();
  await invoke("show_pet");
  timerId = window.setInterval(() => showFrame().catch(console.error), FRAME_MS);
  scheduleMoodChange();
}

pet.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  invoke("start_dragging").catch(console.error);
});

pet.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  invoke("close_pet").catch(console.error);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "1") switchMood("mood1");
  if (event.key === "2") switchMood("mood2");

  if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    movePet(event.key).catch(console.error);
  }

  if (event.key === "Escape") invoke("close_pet").catch(console.error);
});

window.addEventListener("beforeunload", () => {
  window.clearInterval(timerId);
  window.clearTimeout(moodTimerId);
});

start().catch(console.error);
