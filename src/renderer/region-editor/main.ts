import type { RegionEditorApi, RegionInit, RegionRect } from '../../shared/ipc';

declare global {
  interface Window {
    regionEditor: RegionEditorApi;
  }
}

const canvas = document.getElementById('surface') as HTMLCanvasElement;
const hint = document.getElementById('hint') as HTMLElement;
const sizeLabel = document.getElementById('size') as HTMLElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
if (!ctx) throw new Error('2D canvas is unavailable');
const surface: CanvasRenderingContext2D = ctx;

let minSize = 32;
let start: { x: number; y: number } | null = null;
let current: { x: number; y: number } | null = null;
let selection: RegionRect | null = null;

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
  surface.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function normalize(a: { x: number; y: number }, b: { x: number; y: number }): RegionRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function draw(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  surface.clearRect(0, 0, width, height);
  surface.fillStyle = 'rgba(8, 12, 18, 0.45)';
  surface.fillRect(0, 0, width, height);

  selection = start && current ? normalize(start, current) : null;
  if (selection) {
    // Punch the selection out of the dim layer so the target stays readable.
    surface.clearRect(selection.x, selection.y, selection.width, selection.height);
    surface.strokeStyle = '#c8aa6e';
    surface.lineWidth = 2;
    surface.strokeRect(selection.x + 0.5, selection.y + 0.5, selection.width, selection.height);

    const corner = 9;
    surface.strokeStyle = '#f4e2b8';
    surface.lineWidth = 3;
    surface.beginPath();
    surface.moveTo(selection.x, selection.y + corner);
    surface.lineTo(selection.x, selection.y);
    surface.lineTo(selection.x + corner, selection.y);
    surface.moveTo(selection.x + selection.width - corner, selection.y);
    surface.lineTo(selection.x + selection.width, selection.y);
    surface.lineTo(selection.x + selection.width, selection.y + corner);
    surface.moveTo(selection.x, selection.y + selection.height - corner);
    surface.lineTo(selection.x, selection.y + selection.height);
    surface.lineTo(selection.x + corner, selection.y + selection.height);
    surface.moveTo(selection.x + selection.width - corner, selection.y + selection.height);
    surface.lineTo(selection.x + selection.width, selection.y + selection.height);
    surface.lineTo(selection.x + selection.width, selection.y + selection.height - corner);
    surface.stroke();

    sizeLabel.hidden = false;
    sizeLabel.textContent = `${Math.round(selection.width)} × ${Math.round(selection.height)}`;
    sizeLabel.style.left = `${Math.min(selection.x + 8, width - 90)}px`;
    sizeLabel.style.top = `${Math.max(8, selection.y - 28)}px`;
  } else {
    sizeLabel.hidden = true;
  }
}

function reset(message = '按住左键拖出区域，松开确认 · Esc 取消'): void {
  start = null;
  current = null;
  selection = null;
  hint.textContent = message;
  draw();
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    window.regionEditor.cancel();
  }
});
window.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  window.regionEditor.cancel();
});

window.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  start = { x: event.clientX, y: event.clientY };
  current = start;
  hint.textContent = '松开确认 · Esc 取消';
  canvas.setPointerCapture(event.pointerId);
  draw();
});

window.addEventListener('pointermove', (event) => {
  if (!start) return;
  current = { x: event.clientX, y: event.clientY };
  draw();
});

function finish(event: PointerEvent): void {
  if (!start) return;
  current = { x: event.clientX, y: event.clientY };
  const rect = normalize(start, current);
  try { canvas.releasePointerCapture(event.pointerId); } catch { /* pointer already released */ }
  if (rect.width >= minSize && rect.height >= minSize) {
    window.regionEditor.done({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    return;
  }
  reset('区域太小，请重新拖动 · Esc 取消');
}

window.addEventListener('pointerup', finish);
window.addEventListener('pointercancel', () => reset());

window.regionEditor.onInit((init: RegionInit) => {
  minSize = Math.max(8, init.minSize || 32);
  reset();
});

resize();
