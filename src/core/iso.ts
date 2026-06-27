/**
 * Isometric coordinate utilities — pure math, no rendering.
 *
 * SoulForge uses a 2:1 isometric projection (classic AoV/Dota style).
 * Tile size: 64x32 (width x height). The map is a square grid of tiles.
 *
 * Coordinate systems:
 *   - Tile coordinates (col, row): integer grid positions.
 *   - World pixel coordinates (x, y): continuous, used by the ECS Position component.
 *   - Screen pixel coordinates (sx, sy): where on the canvas a point appears.
 *
 * Conversions:
 *   tile  -> world : center of the tile in world space
 *   world -> tile  : which tile a world point lies in
 *   world -> screen: pixel offset on canvas (before camera transform)
 *
 * The renderer applies camera offset separately. Game Core only deals in
 * world coordinates — it never knows about screen space.
 */

export const TILE_W = 64;
export const TILE_H = 32;

/**
 * Tile (col, row) -> world pixel (x, y) at the tile's center.
 */
export function tileToWorld(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

/**
 * World pixel (x, y) -> tile (col, row). Returns fractional values;
 * floor them to get the tile the point is inside.
 */
export function worldToTile(x: number, y: number): { col: number; row: number } {
  const col = (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2;
  const row = (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2;
  return { col, row };
}

/**
 * World pixel (x, y) -> screen pixel (sx, sy) WITHOUT camera.
 * The renderer adds the camera offset to this.
 */
export function worldToScreen(x: number, y: number): { sx: number; sy: number } {
  return {
    sx: x,
    sy: y,
  };
}

/**
 * Screen pixel (sx, sy) -> world pixel (x, y) WITHOUT camera.
 * The renderer subtracts the camera offset before calling this.
 *
 * For 2:1 iso, world->screen is identity (the iso math happens in tile->world),
 * so this is also identity. Kept as a function for symmetry / clarity.
 */
export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  return { x: sx, y: sy };
}
