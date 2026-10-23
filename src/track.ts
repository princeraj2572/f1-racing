// Track layout for the event. Edit this file (with src/content.ts) to reskin the site.
//
// The track is a closed loop of Kenney Racing Kit tiles on a unit grid (1 tile = 1 world unit).
// Each placement names a tile, the grid cell of the top-left corner of its footprint, and a
// clockwise rotation in quarter turns (0 = entering heading north, 1 = east, 2 = south, 3 = west).
// All corner tiles in the kit turn right, so the circuit runs clockwise.

export type TileName =
  | 'roadStart'
  | 'roadStraight'
  | 'roadStraightLong'
  | 'roadCornerSmall'
  | 'roadCornerLarge'
  | 'roadCornerLarger';

export type Rotation = 0 | 1 | 2 | 3;

export interface TilePlacement {
  tile: TileName;
  row: number;
  col: number;
  rotation: Rotation;
}

export interface TileDef {
  kind: 'straight' | 'corner';
  /** Footprint size in tiles before rotation: width along x, height along -z. */
  width: number;
  height: number;
  /** Shift (in model units, before rotation) that centres the road on the grid line. */
  modelOffsetX: number;
}

export const TILE_DEFS: Record<TileName, TileDef> = {
  roadStart: { kind: 'straight', width: 1, height: 2, modelOffsetX: -0.13 },
  roadStraight: { kind: 'straight', width: 1, height: 1, modelOffsetX: 0 },
  roadStraightLong: { kind: 'straight', width: 1, height: 2, modelOffsetX: 0 },
  roadCornerSmall: { kind: 'corner', width: 1, height: 1, modelOffsetX: 0 },
  roadCornerLarge: { kind: 'corner', width: 2, height: 2, modelOffsetX: 0 },
  roadCornerLarger: { kind: 'corner', width: 3, height: 3, modelOffsetX: 0 },
};

// Sample circuit, clockwise: start/finish straight, a tight first corner, a long back straight,
// a wide sweeper into a medium corner (the double bend), a second straight, then a medium corner
// back onto the start line. Tile 0 is the start line.
export const TRACK: readonly TilePlacement[] = [
  { tile: 'roadStart', row: 1, col: 0, rotation: 0 },
  { tile: 'roadCornerSmall', row: 0, col: 0, rotation: 0 },
  { tile: 'roadStraightLong', row: 0, col: 1, rotation: 1 },
  { tile: 'roadStraightLong', row: 0, col: 3, rotation: 1 },
  { tile: 'roadCornerLarger', row: 0, col: 5, rotation: 1 },
  { tile: 'roadCornerLarge', row: 3, col: 6, rotation: 2 },
  { tile: 'roadStraightLong', row: 4, col: 4, rotation: 3 },
  { tile: 'roadStraightLong', row: 4, col: 2, rotation: 3 },
  { tile: 'roadCornerLarge', row: 3, col: 0, rotation: 3 },
];

export interface Vec2 {
  x: number;
  z: number;
}

export interface Port extends Vec2 {
  /** Unit heading of travel through the port, in world axes (x east, z south). */
  hx: number;
  hz: number;
}

/** Clockwise quarter-turn rotation of a point around the origin (x east, z south). */
export function rotate(x: number, z: number, rotation: Rotation): [number, number] {
  switch (rotation) {
    case 0:
      return [x, z];
    case 1:
      return [-z, x];
    case 2:
      return [-x, -z];
    case 3:
      return [z, -x];
  }
}

function footprintMin(def: TileDef, rotation: Rotation): [number, number] {
  const [ax, az] = rotate(0, 0, rotation);
  const [bx, bz] = rotate(def.width, -def.height, rotation);
  return [Math.min(ax, bx), Math.min(az, bz)];
}

/** World position of the model origin of a placed tile. */
export function tileOrigin(p: TilePlacement): Vec2 {
  const [mx, mz] = footprintMin(TILE_DEFS[p.tile], p.rotation);
  return { x: p.col - mx, z: p.row - mz };
}

function toWorld(p: TilePlacement, lx: number, lz: number): Vec2 {
  const o = tileOrigin(p);
  const [rx, rz] = rotate(lx, lz, p.rotation);
  return { x: o.x + rx, z: o.z + rz };
}

function headingOf(rotation: Rotation, lx: number, lz: number): [number, number] {
  const [hx, hz] = rotate(lx, lz, rotation);
  return [Math.round(hx), Math.round(hz)];
}

/** Entry and exit ports of a placed tile, on the road centreline. */
export function tilePorts(p: TilePlacement): { entry: Port; exit: Port } {
  const def = TILE_DEFS[p.tile];
  const entryPos = toWorld(p, 0.5, 0);
  const [ehx, ehz] = headingOf(p.rotation, 0, -1);
  const exitLocal: [number, number] =
    def.kind === 'straight' ? [0.5, -def.height] : [def.width, -(def.height - 0.5)];
  const exitHeading: [number, number] = def.kind === 'straight' ? [0, -1] : [1, 0];
  const exitPos = toWorld(p, exitLocal[0], exitLocal[1]);
  const [xhx, xhz] = headingOf(p.rotation, exitHeading[0], exitHeading[1]);
  return {
    entry: { ...entryPos, hx: ehx, hz: ehz },
    exit: { ...exitPos, hx: xhx, hz: xhz },
  };
}

/** Centreline points of a tile from entry to exit (exit included), world coordinates. */
export function tileWaypoints(p: TilePlacement, arcSteps = 4): Vec2[] {
  const def = TILE_DEFS[p.tile];
  if (def.kind === 'straight') {
    const steps = Math.max(1, Math.round(def.height));
    return Array.from({ length: steps + 1 }, (_, i) => toWorld(p, 0.5, (-def.height * i) / steps));
  }
  const radius = def.width - 0.5;
  return Array.from({ length: arcSteps + 1 }, (_, i) => {
    const theta = Math.PI + ((Math.PI / 2) * i) / arcSteps;
    return toWorld(p, def.width + radius * Math.cos(theta), radius * Math.sin(theta));
  });
}

/** Centreline length of a tile in world units. */
export function tileLength(p: TilePlacement): number {
  const def = TILE_DEFS[p.tile];
  return def.kind === 'straight' ? def.height : (Math.PI / 2) * (def.width - 0.5);
}

/** Grid cells covered by a placed tile, as "row,col" keys. */
export function tileCells(p: TilePlacement): string[] {
  const def = TILE_DEFS[p.tile];
  const swap = p.rotation % 2 === 1;
  const w = swap ? def.height : def.width;
  const h = swap ? def.width : def.height;
  const cells: string[] = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push(`${p.row + r},${p.col + c}`);
  return cells;
}

export interface TrackReport {
  ok: boolean;
  errors: string[];
  corners: number;
  straights: number;
  length: number;
}

const EPS = 1e-6;

/** Checks that every tile connects to the next one and that the loop closes without overlaps. */
export function validateTrack(track: readonly TilePlacement[] = TRACK): TrackReport {
  const errors: string[] = [];
  let corners = 0;
  let straights = 0;
  let length = 0;
  const seen = new Set<string>();

  track.forEach((tile, i) => {
    const next = track[(i + 1) % track.length];
    if (!next) return;
    const a = tilePorts(tile).exit;
    const b = tilePorts(next).entry;
    const apart = Math.hypot(a.x - b.x, a.z - b.z);
    if (apart > EPS)
      errors.push(`tile ${i} (${tile.tile}) does not meet tile ${(i + 1) % track.length}`);
    if (a.hx !== b.hx || a.hz !== b.hz) errors.push(`tile ${i} heading differs from its next tile`);
    if (TILE_DEFS[tile.tile].kind === 'corner') corners++;
    else straights++;
    length += tileLength(tile);
    for (const cell of tileCells(tile)) {
      if (seen.has(cell)) errors.push(`cell ${cell} is covered twice`);
      seen.add(cell);
    }
  });

  return { ok: errors.length === 0, errors, corners, straights, length };
}

export interface TileSpan {
  index: number;
  tile: TileName;
  kind: TileDef['kind'];
  /** Fraction of the lap (0-1) where the tile starts and ends, by centreline distance. */
  start: number;
  end: number;
}

/** Where each tile sits along the lap, for pinning chapters to parts of the track. */
export function tileSpans(track: readonly TilePlacement[] = TRACK): TileSpan[] {
  const total = track.reduce((sum, t) => sum + tileLength(t), 0);
  let run = 0;
  return track.map((t, index) => {
    const start = run / total;
    run += tileLength(t);
    return { index, tile: t.tile, kind: TILE_DEFS[t.tile].kind, start, end: run / total };
  });
}
