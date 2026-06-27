/**
 * EntityRenderer — bridges ECS sprite state to Pixi display objects.
 *
 * Reads Sprite.spriteId from each ECS entity and maintains a corresponding
 * Pixi display object. Updates positions every frame from Position components.
 *
 * Phase 0: draws the player as a stylized circle+triangle (placeholder for
 * anime sprite). In Phase 1+ we'll load actual sprite sheets.
 */

import { Container, Graphics } from "pixi.js";
import { defineQuery } from "bitecs";
import { world, Position, Sprite } from "@core/ecs/world";

const spriteQuery = defineQuery([Position, Sprite]);

interface SpriteEntry {
  display: Container;
  zLayer: number;
}

/**
 * Build a placeholder player sprite: a circle (body) + triangle (hair/cloak)
 * + small indicator for facing direction. Anime-stylized proportions.
 *
 * Color palette: dark cloak + warm accent — placeholder until real sprites.
 */
function buildPlayerSprite(): Container {
  const c = new Container();
  c.label = "PlayerSprite";

  const shadow = new Graphics();
  shadow.ellipse(0, 4, 14, 6);
  shadow.fill({ color: 0x000000, alpha: 0.35 });
  c.addChild(shadow);

  const body = new Graphics();
  // Cloak (lower body)
  body.moveTo(-10, 4);
  body.lineTo(10, 4);
  body.lineTo(7, -8);
  body.lineTo(-7, -8);
  body.closePath();
  body.fill({ color: 0x2a2440 });
  // Torso
  body.moveTo(-7, -8);
  body.lineTo(7, -8);
  body.lineTo(5, -16);
  body.lineTo(-5, -16);
  body.closePath();
  body.fill({ color: 0x3a3460 });
  // Head
  body.circle(0, -22, 6);
  body.fill({ color: 0xf0d8b8 });
  // Hair
  body.moveTo(-6, -24);
  body.lineTo(6, -24);
  body.lineTo(7, -19);
  body.lineTo(-7, -19);
  body.closePath();
  body.fill({ color: 0x6a4a8a });
  // Accent (sash)
  body.rect(-7, -10, 14, 2);
  body.fill({ color: 0xffb86c });
  c.addChild(body);

  return c;
}

/**
 * A simple debug marker for click-to-move target.
 */
function buildMarkerSprite(): Container {
  const g = new Graphics();
  g.circle(0, 0, 5);
  g.fill({ color: 0xffb86c, alpha: 0.7 });
  g.circle(0, 0, 10);
  g.stroke({ color: 0xffb86c, width: 1, alpha: 0.4 });
  return g;
}

export class EntityRenderer {
  readonly container: Container;
  private sprites: Map<number, SpriteEntry> = new Map();

  constructor() {
    this.container = new Container();
    this.container.label = "Entities";
  }

  /**
   * Sync Pixi display objects with ECS state. Called every frame.
   */
  sync() {
    const entities = spriteQuery(world);

    // Add new entities
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      if (!this.sprites.has(eid)) {
        const spriteId = Sprite.spriteId[eid];
        let display: Container;
        if (spriteId === 0) {
          display = buildPlayerSprite();
        } else {
          display = buildMarkerSprite();
        }
        display.zIndex = Sprite.zLayer[eid];
        this.container.addChild(display);
        this.sprites.set(eid, { display, zLayer: Sprite.zLayer[eid] });
      }
    }

    // Remove deleted entities — bitecs recycles IDs, so we check current set
    const currentSet = new Set(entities);
    for (const [eid, entry] of this.sprites.entries()) {
      if (!currentSet.has(eid)) {
        this.container.removeChild(entry.display);
        entry.display.destroy();
        this.sprites.delete(eid);
      }
    }

    // Update positions
    for (const [eid, entry] of this.sprites.entries()) {
      entry.display.x = Position.x[eid];
      entry.display.y = Position.y[eid];
    }

    // Sort by Y (depth) so closer-to-camera sprites render in front
    this.container.children.sort((a, b) => a.y - b.y);
  }
}
