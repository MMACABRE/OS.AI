import { MAX_BACKDROP_FPS, STILL_WARMUP_STEPS } from './protocol';
import type { BackdropSettings, FromBackdropWorker, ToBackdropWorker } from './protocol';
import { sceneFor } from './scenes';
import type { Scene, SceneConfig } from './scenes/types';

/*
 * The background worker (UI-30, UI-32): it owns the OffscreenCanvas and runs the scene, so drawing never
 * touches the renderer's main thread. One loop, at most backdrop.fps frames a second, paused while the
 * window is hidden; under reduced motion one frame and no loop.
 */
// The worker scope, typed with only what this file uses (the ui is compiled with the DOM library).
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<ToBackdropWorker>) => void) | null;
  postMessage(message: FromBackdropWorker): void;
};

let context: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
let scene: Scene | null = null;
let sceneName = '';
let image: ImageData | null = null;
let pixels: Uint32Array | null = null;
let settings: BackdropSettings | null = null;
let hidden = false;
let frames = 0;
let lastFrameAt = 0;
let loop: number | null = null;
let pointer: { x: number; y: number } | null = null;

const frameGapMs = () => 1000 / Math.max(1, Math.min(MAX_BACKDROP_FPS, settings?.fps ?? MAX_BACKDROP_FPS));

function draw() {
  if (context === null || scene === null || image === null || pixels === null) return;
  scene.render(pixels);
  context.putImageData(image, 0, 0);
  frames += 1;
}

function stopLoop() {
  if (loop !== null) cancelAnimationFrame(loop);
  loop = null;
}

function tick(now: number) {
  loop = requestAnimationFrame(tick);
  if (now - lastFrameAt < frameGapMs() - 1) return;
  lastFrameAt = now;
  scene?.step();
  draw();
}

/** Starts or stops the loop to match visibility and motion settings. */
function schedule() {
  if (scene === null) return;
  if (settings?.reduced === true) {
    stopLoop();
    for (let i = 0; i < STILL_WARMUP_STEPS; i++) scene.step();
    draw();
    return;
  }
  if (hidden) stopLoop();
  else if (loop === null) loop = requestAnimationFrame(tick);
}

/** The scene's config, with crt.barrel turned from window pixels into canvas pixels (UI-34). */
const sceneConfig = (next: BackdropSettings, width: number): SceneConfig => ({
  ...next.config,
  barrelPx: next.viewportWidth > 0 ? (next.barrel * width) / next.viewportWidth : 0,
});

function applySettings(next: BackdropSettings) {
  const chosen = sceneFor(next.scene);
  if (scene === null || chosen.name !== sceneName) {
    scene = chosen.create(sceneConfig(next, 1));
    scene.configure(sceneConfig(next, scene.width));
    sceneName = chosen.name;
    if (canvas !== null) {
      canvas.width = scene.width;
      canvas.height = scene.height;
      context = canvas.getContext('2d', { alpha: false });
      image = context?.createImageData(scene.width, scene.height) ?? null;
      pixels = image === null ? null : new Uint32Array(image.data.buffer);
    }
  } else scene.configure(sceneConfig(next, scene.width));
  settings = next;
  stopLoop();
  schedule();
}

worker.onmessage = (event: MessageEvent<ToBackdropWorker>) => {
  const message = event.data;
  switch (message.type) {
    case 'start':
      canvas = message.canvas;
      applySettings(message.settings);
      break;
    case 'settings':
      applySettings(message.settings);
      break;
    case 'pointer':
      if (settings?.reduced !== true) {
        const from = pointer ?? message;
        scene?.stir(message.x, message.y, message.x - from.x, message.y - from.y);
      }
      pointer = { x: message.x, y: message.y };
      break;
    case 'puff':
      if (settings?.reduced !== true) scene?.puff(message.x, message.y);
      break;
    case 'sources':
      scene?.setSources(message.sources);
      break;
    case 'visibility':
      hidden = message.hidden;
      schedule();
      break;
    case 'stats': {
      const reply: FromBackdropWorker = { type: 'stats', frames, scene: sceneName };
      worker.postMessage(reply);
      break;
    }
  }
};
