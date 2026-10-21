import { BrowserWindow, ipcMain, screen, type Display } from 'electron';
import {
  REGION_CANCEL, REGION_DONE, REGION_INIT, type RegionInit, type RegionRect,
} from '../shared/ipc';
import { IS_MAC, loadPage, preloadPath } from './paths';

interface Pending {
  win: BrowserWindow;
  display: Display;
  minSize: number;
  timer: NodeJS.Timeout;
  resolve: (rect: RegionRect | null) => void;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const validRect = (v: unknown): v is RegionRect => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return finite(r.x) && finite(r.y) && finite(r.width) && finite(r.height);
};

/**
 * A temporary, fully interactive full-display surface for drawing one rectangle.
 * The normal overlays are click-through, so this lives in its own window and is
 * destroyed before the screenshot is taken.
 */
export class RegionEditor {
  private pending: Pending | null = null;

  constructor() {
    ipcMain.on(REGION_DONE, (event, raw: unknown) => {
      if (!this.pending || event.sender !== this.pending.win.webContents) return;
      if (!validRect(raw)) { this.finish(this.pending, null); return; }
      this.finish(this.pending, raw);
    });
    ipcMain.on(REGION_CANCEL, (event) => {
      if (!this.pending || event.sender !== this.pending.win.webContents) return;
      this.finish(this.pending, null);
    });
  }

  /** Resolves the confirmed rectangle in global logical (DIP) coordinates, or null when cancelled. */
  pick({ point, minSize = 32 }: { point: { x: number; y: number }; minSize?: number }): Promise<RegionRect | null> {
    if (this.pending) this.finish(this.pending, null);
    const display = screen.getDisplayNearestPoint({ x: Math.round(point.x), y: Math.round(point.y) });
    const win = new BrowserWindow({
      ...display.bounds,
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: true,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      show: false,
      type: IS_MAC ? 'panel' : 'window',
      webPreferences: {
        preload: preloadPath('overlay'),
        backgroundThrottling: false,
        spellcheck: false,
      },
    });
    win.setIgnoreMouseEvents(false);
    win.setFocusable(true);
    win.setAlwaysOnTop(true, 'screen-saver');
    if (IS_MAC) {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
      win.setHiddenInMissionControl(true);
    }

    return new Promise<RegionRect | null>((resolve) => {
      let pending!: Pending;
      const timer = setTimeout(() => { if (this.pending === pending) this.finish(pending, null); }, 30_000);
      pending = { win, display, minSize: Math.max(8, Math.round(minSize)), timer, resolve };
      this.pending = pending;
      win.once('ready-to-show', () => {
        if (win.isDestroyed()) return;
        win.setBounds(display.bounds);
        win.show();
        win.setFocusable(true);
        win.focus();
        win.moveTop();
      });
      win.webContents.once('did-finish-load', () => {
        if (win.isDestroyed()) return;
        const init: RegionInit = { display: { ...display.bounds }, minSize: pending.minSize };
        win.webContents.send(REGION_INIT, init);
      });
      win.on('closed', () => {
        if (this.pending === pending) this.finish(pending, null, false);
      });
      void loadPage(win, 'region-editor');
    });
  }

  close(): void {
    if (this.pending) this.finish(this.pending, null);
  }

  private finish(pending: Pending, local: RegionRect | null, destroy = true): void {
    if (this.pending !== pending) return;
    this.pending = null;
    clearTimeout(pending.timer);

    let rect: RegionRect | null = null;
    if (local) {
      const { width: dw, height: dh } = pending.display.bounds;
      const left = Math.max(0, Math.min(dw, Math.round(local.x)));
      const top = Math.max(0, Math.min(dh, Math.round(local.y)));
      const right = Math.max(0, Math.min(dw, Math.round(local.x + local.width)));
      const bottom = Math.max(0, Math.min(dh, Math.round(local.y + local.height)));
      const width = right - left;
      const height = bottom - top;
      if (width >= pending.minSize && height >= pending.minSize) {
        rect = {
          x: pending.display.bounds.x + left,
          y: pending.display.bounds.y + top,
          width,
          height,
        };
      }
    }

    if (destroy && !pending.win.isDestroyed()) pending.win.destroy();
    pending.resolve(rect);
  }
}

