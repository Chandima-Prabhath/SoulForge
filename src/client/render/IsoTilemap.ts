/**
 * IsoTilemap — PixiJS renderer for an isometric tilemap.
 *
 * Phase 4: tile colors now come from the biome, not hardcoded. The tilemap
 * accepts a BiomeDef and uses its tileColors to shade tiles. This means
 * forest realms look green, cave realms look brown/orange, and void realms
 * look purple/dark.
 *
 * Tile codes:
 *   0 = grass (walkable) — biome-specific ground color
 *   1 = path (walkable) — biome-specific path color
 *   2 = rock (obstacle) — biome-specific rock color
 *   3 = water (obstacle) — biome-specific water/lava/void color
 *   4 = accent (boss arena floor) — biome-specific accent color
 */

import { Container, Graphics } from "pixi.js";
import { TILE_W, TILE_H, tileToWorld } from "@core/iso";
import type { RealmData } from "@data/realms";
import type { BiomeDef } from "@data/biomes";
import { getBiomeById } from "@data/biomes";

export class IsoTilemap {
  readonly container: Container;
  private gfx: Graphics;
  private realm: RealmData;
  private biome: BiomeDef | undefined;

  constructor(realm: RealmData) {
    this.realm = realm;
    this.biome = getBiomeById(realm.biome);
    this.container = new Container();
    this.container.label = "IsoTilemap";
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    this.draw();
  }

  private draw() {
    const { width, height, tiles } = this.realm;
    this.gfx.clear();

    // Use biome colors if available, otherwise default to forest palette
    const colors = this.biome?.tileColors;
    const tileColors: Record<number, number> = {
      0: colors?.grass ?? 0x4a7c3a,
      1: colors?.path ?? 0x9c8456,
      2: colors?.rock ?? 0x6b6b75,
      3: colors?.water ?? 0x3a6db0,
      4: colors?.accent ?? 0xffb86c,
      // Match mode tiles:
      5: 0x2a3a5a,  // player territory (blue-tinted)
      6: 0x5a2a2a,  // enemy territory (red-tinted)
      7: 0x4a5a8a,  // player path (blue-tinted)
      8: 0x8a4a4a,  // enemy path (red-tinted)
    };

    // Derive edge colors (darker shade of each tile color)
    const tileEdgeColors: Record<number, number> = {};
    for (const k of Object.keys(tileColors)) {
      const key = Number(k);
      tileEdgeColors[key] = (tileColors[key] & 0xfefefe) >> 1;
    }

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tileCode = tiles[row * width + col];
        const color = tileColors[tileCode] ?? tileColors[0];
        const edge = tileEdgeColors[tileCode] ?? tileEdgeColors[0];
        const { x, y } = tileToWorld(col, row);

        // Diamond polygon
        this.gfx.moveTo(x, y - TILE_H / 2);
        this.gfx.lineTo(x + TILE_W / 2, y);
        this.gfx.lineTo(x, y + TILE_H / 2);
        this.gfx.lineTo(x - TILE_W / 2, y);
        this.gfx.closePath();
        this.gfx.fill({ color });
        this.gfx.stroke({ color: edge, width: 0.5, alpha: 0.4 });

        // Boss arena accent — draw a glowing center marker on accent tiles
        if (tileCode === 4) {
          this.gfx.circle(x, y, 2);
          this.gfx.fill({ color: 0xffffff, alpha: 0.3 });
        }
      }
    }
  }

  /**
   * Test whether a world point is inside the map bounds.
   */
  isInside(col: number, row: number): boolean {
    return (
      col >= 0 &&
      row >= 0 &&
      col < this.realm.width &&
      row < this.realm.height
    );
  }

  /**
   * Get the biome definition for this tilemap's realm.
   */
  getBiome(): BiomeDef | undefined {
    return this.biome;
  }
}
