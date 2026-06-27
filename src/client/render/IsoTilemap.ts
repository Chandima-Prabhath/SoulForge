/**
 * IsoTilemap — PixiJS renderer for an isometric tilemap.
 *
 * This is a CLIENT-only class. It owns Pixi display objects and is
 * never imported from src/core/. Game Core produces RealmData; the
 * renderer consumes it.
 *
 * Phase 0: draws flat-shaded diamond tiles. No sprites yet — that's Phase 1.
 * Tiles are drawn as Graphics polygons with biome-appropriate colors.
 */

import { Container, Graphics } from "pixi.js";
import { TILE_W, TILE_H, tileToWorld } from "@core/iso";
import type { RealmData } from "@data/realms";

const TILE_COLORS: Record<number, number> = {
  0: 0x4a7c3a, // grass — forest green
  1: 0x9c8456, // path — tan
  2: 0x6b6b75, // rock — slate
  3: 0x3a6db0, // water — blue
};

const TILE_EDGE_COLORS: Record<number, number> = {
  0: 0x3a6028,
  1: 0x7a6840,
  2: 0x4a4a55,
  3: 0x2a4d80,
};

export class IsoTilemap {
  readonly container: Container;
  private gfx: Graphics;
  private realm: RealmData;

  constructor(realm: RealmData) {
    this.realm = realm;
    this.container = new Container();
    this.container.label = "IsoTilemap";
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    this.draw();
  }

  private draw() {
    const { width, height, tiles } = this.realm;
    this.gfx.clear();

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tileCode = tiles[row * width + col];
        const color = TILE_COLORS[tileCode] ?? TILE_COLORS[0];
        const edge = TILE_EDGE_COLORS[tileCode] ?? TILE_EDGE_COLORS[0];
        const { x, y } = tileToWorld(col, row);

        // Diamond polygon
        this.gfx.moveTo(x, y - TILE_H / 2);
        this.gfx.lineTo(x + TILE_W / 2, y);
        this.gfx.lineTo(x, y + TILE_H / 2);
        this.gfx.lineTo(x - TILE_W / 2, y);
        this.gfx.closePath();
        this.gfx.fill({ color });
        this.gfx.stroke({ color: edge, width: 0.5, alpha: 0.4 });
      }
    }
  }

  /**
   * Test whether a world point is inside the map bounds.
   * Phase 0 uses this only for HUD display — collision comes later.
   */
  isInside(col: number, row: number): boolean {
    return (
      col >= 0 &&
      row >= 0 &&
      col < this.realm.width &&
      row < this.realm.height
    );
  }
}
