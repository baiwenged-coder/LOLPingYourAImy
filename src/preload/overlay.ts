import { contextBridge, ipcRenderer } from 'electron';
import type { EmoteRef } from '../shared/emotes';
import {
  AGENT_PING_ENDED, OVERLAY_ASSETS, OVERLAY_CHANNELS, OVERLAY_EMOTED, OVERLAY_PINGED,
  REGION_CANCEL, REGION_DONE, REGION_INIT,
  type OverlayChannel, type OverlayEvents, type RegionEditorApi, type RegionInit, type RegionRect,
} from '../shared/ipc';
import type { PingId } from '../shared/pings';

const api = {
  agentPingEnded(requestId: number): void { ipcRenderer.send(AGENT_PING_ENDED, requestId); },
  on<C extends OverlayChannel>(channel: C, cb: (payload: OverlayEvents[C]) => void): void {
    if (!OVERLAY_CHANNELS.includes(channel)) throw new Error(`unknown overlay channel: ${channel}`);
    ipcRenderer.on(channel, (_event, payload: OverlayEvents[C]) => cb(payload));
  },
  reportMissingAssets(names: string[]): void {
    ipcRenderer.send(OVERLAY_ASSETS, names);
  },
  /** A wheel ping was placed here (CSS px in this overlay). */
  reportPing(id: PingId, x: number, y: number): void {
    ipcRenderer.send(OVERLAY_PINGED, { id, x, y });
  },
  /** A wheel emote was placed here (CSS px in this overlay). */
  reportEmote(ref: EmoteRef, x: number, y: number): void {
    ipcRenderer.send(OVERLAY_EMOTED, { ref, x, y });
  },
};

contextBridge.exposeInMainWorld('overlay', api);

// The region editor reuses this preload: adding a fourth preload entry made
// Rollup emit a shared chunk that Electron's sandboxed preload cannot require.
const regionApi: RegionEditorApi = {
  onInit(cb: (init: RegionInit) => void): void {
    ipcRenderer.on(REGION_INIT, (_event, init: RegionInit) => cb(init));
  },
  done(rect: RegionRect): void {
    ipcRenderer.send(REGION_DONE, rect);
  },
  cancel(): void {
    ipcRenderer.send(REGION_CANCEL);
  },
};
contextBridge.exposeInMainWorld('regionEditor', regionApi);

export type OverlayApi = typeof api;
