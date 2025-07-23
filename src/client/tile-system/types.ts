export interface TileKey {
  facilityName: string;
  year: number;
}

export interface TileData {
  facilityName: string;
  year: number;
  units: Array<{
    duid: string;
    capacity: number;
    data: Array<number | null>; // 365 or 366 days of capacity factors
  }>;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface RenderedTile {
  key: TileKey;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  renderedAt: number;
  renderTime: number; // ms
}

export type TileState = 'empty' | 'loading' | 'loaded' | 'rendering' | 'ready' | 'error';

export interface TileStatus {
  key: TileKey;
  state: TileState;
  data?: TileData;
  rendered?: RenderedTile;
  error?: Error;
}

export interface ViewportInfo {
  startDate: Date;
  endDate: Date;
  width: number;
  height: number;
  pixelsPerDay: number;
}