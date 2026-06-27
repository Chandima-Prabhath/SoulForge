/**
 * EntityRenderer — bridges ECS sprite state to Pixi display objects.
 *
 * Reads Sprite.spriteId from each ECS entity and maintains a corresponding
 * Pixi display object. Updates positions every frame from Position components.
 *
 * Sprite ID registry:
 *   0 = player character
 *   1 = mana bolt projectile
 *   2 = damage number (Pixi Text)
 *   3 = essence shard
 *   4 = enemy slime
 *
 * For entities with Health, a small health bar is rendered above the sprite.
 * For damage numbers, a Pixi Text shows the damage value and fades with age.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { defineQuery, hasComponent } from "bitecs";
import {
  world,
  Position,
  Sprite,
  Health,
  DamageNumber,
  Team,
  Lifetime,
} from "@core/ecs/world";

const spriteQuery = defineQuery([Position, Sprite]);

interface SpriteEntry {
  display: Container;
  zLayer: number;
  // Optional health bar reference for entities with Health
  healthBar?: Graphics;
  // Optional text reference for damage numbers
  text?: Text;
  // Track last spriteId so we rebuild if it changes
  spriteId: number;
  // Track team for tinting
  teamId: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprite Builders
// ─────────────────────────────────────────────────────────────────────────────

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

function buildEnemySprite(): Container {
  const c = new Container();
  c.label = "EnemySprite";

  const shadow = new Graphics();
  shadow.ellipse(0, 4, 16, 7);
  shadow.fill({ color: 0x000000, alpha: 0.4 });
  c.addChild(shadow);

  const body = new Graphics();
  // Slime body — rounded blob
  body.moveTo(-14, 4);
  body.quadraticCurveTo(-14, -14, 0, -14);
  body.quadraticCurveTo(14, -14, 14, 4);
  body.closePath();
  body.fill({ color: 0x8a3a4a });
  body.stroke({ color: 0x5a2030, width: 1 });
  // Highlight
  body.ellipse(-4, -8, 4, 3);
  body.fill({ color: 0xc86a7a, alpha: 0.7 });
  // Eyes — angry slits
  body.moveTo(-6, -4);
  body.lineTo(-3, -2);
  body.moveTo(6, -4);
  body.lineTo(3, -2);
  body.stroke({ color: 0xffffff, width: 1.5 });
  c.addChild(body);

  return c;
}

function buildManaBoltSprite(): Container {
  const c = new Container();
  c.label = "ManaBolt";

  const g = new Graphics();
  // Outer glow
  g.circle(0, 0, 12);
  g.fill({ color: 0x8a4af0, alpha: 0.25 });
  // Mid glow
  g.circle(0, 0, 7);
  g.fill({ color: 0xb070ff, alpha: 0.5 });
  // Core
  g.circle(0, 0, 4);
  g.fill({ color: 0xe0c8ff });
  c.addChild(g);

  return c;
}

function buildEssenceShardSprite(): Container {
  const c = new Container();
  c.label = "EssenceShard";

  const g = new Graphics();
  // Outer aura
  g.circle(0, 0, 9);
  g.fill({ color: 0xffb86c, alpha: 0.2 });
  // Diamond shape
  g.moveTo(0, -6);
  g.lineTo(5, 0);
  g.lineTo(0, 6);
  g.lineTo(-5, 0);
  g.closePath();
  g.fill({ color: 0xffd070 });
  g.stroke({ color: 0xff9040, width: 1 });
  c.addChild(g);

  return c;
}

function buildHealthBar(width = 32): Graphics {
  const g = new Graphics();
  // Background
  g.roundRect(-width / 2, 0, width, 4, 1);
  g.fill({ color: 0x000000, alpha: 0.6 });
  g.stroke({ color: 0x000000, alpha: 0.8, width: 0.5 });
  // Foreground (full red — will be redrawn each frame based on health)
  g.roundRect(-width / 2 + 0.5, 0.5, width - 1, 3, 1);
  g.fill({ color: 0xff4040 });
  return g;
}

// Pre-built text style for damage numbers
const damageTextStyle = new TextStyle({
  fontFamily: "SF Mono, Monaco, Consolas, monospace",
  fontSize: 16,
  fontWeight: "bold",
  fill: 0xffe060,
  stroke: { color: 0x000000, width: 3 },
});

function buildDamageNumberText(): Text {
  return new Text({ text: "", style: damageTextStyle });
}

// ─────────────────────────────────────────────────────────────────────────────
// EntityRenderer
// ─────────────────────────────────────────────────────────────────────────────

export class EntityRenderer {
  readonly container: Container;
  private sprites: Map<number, SpriteEntry> = new Map();

  constructor() {
    this.container = new Container();
    this.container.label = "Entities";
  }

  private buildDisplayFor(spriteId: number): { display: Container; isText?: boolean } {
    switch (spriteId) {
      case 0:
        return { display: buildPlayerSprite() };
      case 1:
        return { display: buildManaBoltSprite() };
      case 2:
        return { display: buildDamageNumberText(), isText: true };
      case 3:
        return { display: buildEssenceShardSprite() };
      case 4:
        return { display: buildEnemySprite() };
      default:
        return { display: buildManaBoltSprite() }; // fallback
    }
  }

  /**
   * Sync Pixi display objects with ECS state. Called every frame.
   */
  sync() {
    const entities = spriteQuery(world);

    // Add new entities
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const spriteId = Sprite.spriteId[eid];
      const teamId = hasComponent(world, Team, eid) ? Team.id[eid] : -1;

      if (!this.sprites.has(eid)) {
        const { display, isText } = this.buildDisplayFor(spriteId);
        display.zIndex = Sprite.zLayer[eid];

        const entry: SpriteEntry = {
          display,
          zLayer: Sprite.zLayer[eid],
          spriteId,
          teamId,
        };

        if (isText) {
          entry.text = display as Text;
        }

        // Add a health bar for entities with Health
        if (hasComponent(world, Health, eid)) {
          const bar = buildHealthBar(32);
          bar.zIndex = 5;
          display.addChild(bar);
          entry.healthBar = bar;
        }

        this.container.addChild(display);
        this.sprites.set(eid, entry);
      } else {
        // Sprite ID changed — rebuild (rare, but safe)
        const entry = this.sprites.get(eid)!;
        if (entry.spriteId !== spriteId) {
          this.container.removeChild(entry.display);
          entry.display.destroy();
          const { display, isText } = this.buildDisplayFor(spriteId);
          display.zIndex = Sprite.zLayer[eid];
          entry.display = display;
          entry.spriteId = spriteId;
          entry.text = isText ? (display as Text) : undefined;
          if (hasComponent(world, Health, eid)) {
            const bar = buildHealthBar(32);
            bar.zIndex = 5;
            display.addChild(bar);
            entry.healthBar = bar;
          } else {
            entry.healthBar = undefined;
          }
          this.container.addChild(display);
        }
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

    // Update positions + dynamic state
    for (const [eid, entry] of this.sprites.entries()) {
      const disp = entry.display;
      disp.x = Position.x[eid];
      disp.y = Position.y[eid];

      // Update health bar
      if (entry.healthBar && hasComponent(world, Health, eid)) {
        const ratio = Health.current[eid] / Health.max[eid];
        // Redraw the foreground (simplest approach: clear and redraw)
        entry.healthBar.clear();
        const w = 32;
        entry.healthBar.roundRect(-w / 2, 0, w, 4, 1);
        entry.healthBar.fill({ color: 0x000000, alpha: 0.6 });
        entry.healthBar.stroke({ color: 0x000000, alpha: 0.8, width: 0.5 });
        const fgWidth = Math.max(0, (w - 1) * ratio);
        if (fgWidth > 0) {
          entry.healthBar.roundRect(-w / 2 + 0.5, 0.5, fgWidth, 3, 1);
          // Color shifts: green (full) → yellow (half) → red (low)
          let color = 0x40ff40;
          if (ratio < 0.5) color = 0xffe040;
          if (ratio < 0.25) color = 0xff4040;
          entry.healthBar.fill({ color });
        }
        // Position the health bar above the sprite
        entry.healthBar.y = -36;
        entry.healthBar.x = 0;
      }

      // Update damage number text + fade with age
      if (entry.text && hasComponent(world, DamageNumber, eid)) {
        const val = Math.round(DamageNumber.value[eid]);
        entry.text.text = val > 0 ? String(val) : "✦";
        const age = DamageNumber.age[eid];
        const ttl = DamageNumber.ttl[eid];
        const t = age / ttl;
        entry.text.alpha = 1 - t * t; // ease-out fade
        entry.text.scale.set(1 + t * 0.3); // slight grow
      }

      // Fade out essence shards near end of lifetime
      if (hasComponent(world, Lifetime, eid) && entry.spriteId === 3) {
        const remaining = Lifetime.remaining[eid];
        if (remaining < 2) {
          // Pulse + fade
          const pulse = 0.5 + 0.5 * Math.sin(remaining * 12);
          disp.alpha = (remaining / 2) * (0.5 + 0.5 * pulse);
        } else {
          disp.alpha = 1;
        }
      }

      // Pulse mana bolt projectiles
      if (entry.spriteId === 1) {
        const t = performance.now() / 100;
        disp.scale.set(0.9 + 0.15 * Math.sin(t));
      }
    }

    // Sort by Y (depth) so closer-to-camera sprites render in front
    this.container.children.sort((a, b) => a.y - b.y);
  }
}
