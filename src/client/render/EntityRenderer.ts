/**
 * EntityRenderer — bridges ECS sprite state to Pixi display objects.
 *
 * Reads Sprite.spriteId from each ECS entity and maintains a corresponding
 * Pixi display object. Updates positions every frame from Position components.
 *
 * Sprite ID registry:
 *   0 = player character
 *   1 = projectile (color comes from Projectile.color — element-driven)
 *   2 = damage number (Pixi Text)
 *   3 = essence shard
 *   4 = enemy slime
 *   5 = nova ring (reads NovaRing component for radius/color)
 *
 * For entities with Health, a small health bar is rendered above the sprite.
 * For damage numbers, a Pixi Text shows the damage value and fades with age.
 * For entities with Beam, a line is drawn from start to end with element color.
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
  Projectile,
  Beam,
  NovaRing,
  LingeringArea,
  EnemyType,
  EssenceShard,
} from "@core/ecs/world";
import { ENEMY_TYPES } from "@data/enemies";

const spriteQuery = defineQuery([Position, Sprite]);
const beamQuery = defineQuery([Beam]);
const novaQuery = defineQuery([NovaRing, Position]);

interface SpriteEntry {
  display: Container;
  zLayer: number;
  healthBar?: Graphics;
  text?: Text;
  spriteId: number;
  teamId: number;
  // For projectiles — store element color so we can rebuild if it changes
  elementColor: number;
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

function buildEnemySprite(primaryColor: number = 0x8a3a4a): Container {
  const c = new Container();
  c.label = "EnemySprite";

  // Derive a darker stroke color from the primary
  const strokeColor = (primaryColor & 0xfefefe) >> 1;
  // Derive a lighter highlight color
  const highlightColor = Math.min(0xffffff, primaryColor + 0x404040);

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
  body.fill({ color: primaryColor });
  body.stroke({ color: strokeColor, width: 1 });
  // Highlight
  body.ellipse(-4, -8, 4, 3);
  body.fill({ color: highlightColor, alpha: 0.7 });
  // Eyes — angry slits
  body.moveTo(-6, -4);
  body.lineTo(-3, -2);
  body.moveTo(6, -4);
  body.lineTo(3, -2);
  body.stroke({ color: 0xffffff, width: 1.5 });
  c.addChild(body);

  return c;
}

/**
 * Build a projectile sprite with the element's color.
 * Phase 2: 3 concentric circles (outer glow, mid, core) tinted by element.
 */
function buildProjectileSprite(color: number, accentColor: number): Container {
  const c = new Container();
  c.label = "Projectile";

  const g = new Graphics();
  // Outer glow
  g.circle(0, 0, 12);
  g.fill({ color, alpha: 0.25 });
  // Mid glow
  g.circle(0, 0, 7);
  g.fill({ color, alpha: 0.5 });
  // Core
  g.circle(0, 0, 4);
  g.fill({ color: accentColor });
  c.addChild(g);

  // Store colors for pulse animation
  c.label = `Projectile:${color.toString(16)}`;
  return c;
}

function buildEssenceShardSprite(color: number = 0xffb86c): Container {
  const c = new Container();
  c.label = "EssenceShard";

  // Derive lighter and darker shades
  const lightColor = Math.min(0xffffff, color + 0x202020);
  const darkColor = (color & 0xfefefe) >> 1;

  const g = new Graphics();
  // Outer aura
  g.circle(0, 0, 9);
  g.fill({ color, alpha: 0.2 });
  // Diamond shape
  g.moveTo(0, -6);
  g.lineTo(5, 0);
  g.lineTo(0, 6);
  g.lineTo(-5, 0);
  g.closePath();
  g.fill({ color: lightColor });
  g.stroke({ color: darkColor, width: 1 });
  c.addChild(g);

  return c;
}

function buildHealthBar(width = 32): Graphics {
  const g = new Graphics();
  g.roundRect(-width / 2, 0, width, 4, 1);
  g.fill({ color: 0x000000, alpha: 0.6 });
  g.stroke({ color: 0x000000, alpha: 0.8, width: 0.5 });
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

  // Beam VFX — separate from sprites because they don't have Position-driven movement
  private beamGraphics: Map<number, Graphics> = new Map();

  // Nova ring VFX — one Graphics per nova, redrawn each frame as it expands
  private novaGraphics: Map<number, Graphics> = new Map();

  // Lingering area VFX — one Graphics per area, redrawn each frame
  private lingeringGraphics: Map<number, Graphics> = new Map();

  // Devour VFX — expanding purple ring when Devour skill is cast
  private devourVfxGraphics: Map<number, Graphics> = new Map();

  constructor() {
    this.container = new Container();
    this.container.label = "Entities";
  }

  private buildDisplayFor(
    spriteId: number,
    elementColor: number = 0xe0e0e8,
    accentColor: number = 0xffffff,
    entityId: number = -1
  ): { display: Container; isText?: boolean } {
    switch (spriteId) {
      case 0:
        return { display: buildPlayerSprite() };
      case 1:
        return { display: buildProjectileSprite(elementColor, accentColor) };
      case 2:
        return { display: buildDamageNumberText(), isText: true };
      case 3:
        // Essence shard — color based on the enemy type that dropped it
        if (entityId >= 0 && hasComponent(world, EssenceShard, entityId)) {
          const typeId = EssenceShard.enemyTypeId[entityId];
          const enemyDef = ENEMY_TYPES[typeId];
          if (enemyDef) {
            return { display: buildEssenceShardSprite(enemyDef.color) };
          }
        }
        return { display: buildEssenceShardSprite() };
      case 4:
        // Enemy — color based on enemy type
        if (entityId >= 0 && hasComponent(world, EnemyType, entityId)) {
          const typeId = EnemyType.typeId[entityId];
          const enemyDef = ENEMY_TYPES[typeId];
          if (enemyDef) {
            return { display: buildEnemySprite(enemyDef.color) };
          }
        }
        return { display: buildEnemySprite() };
      case 5:
        // Nova ring — placeholder container, drawn dynamically in sync()
        return { display: new Graphics() };
      case 6:
        // Lingering area — drawn dynamically in syncLingeringAreas()
        return { display: new Graphics() };
      case 7:
        // Devour VFX — drawn dynamically in syncDevourVfx()
        return { display: new Graphics() };
      default:
        return { display: buildProjectileSprite(elementColor, accentColor) };
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
      const elementColor = hasComponent(world, Projectile, eid)
        ? Projectile.color[eid]
        : 0xe0e0e8;
      const accentColor = hasComponent(world, Projectile, eid)
        ? Projectile.accentColor[eid]
        : 0xffffff;

      if (!this.sprites.has(eid)) {
        const { display, isText } = this.buildDisplayFor(spriteId, elementColor, accentColor, eid);
        display.zIndex = Sprite.zLayer[eid];

        const entry: SpriteEntry = {
          display,
          zLayer: Sprite.zLayer[eid],
          spriteId,
          teamId,
          elementColor,
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
        const entry = this.sprites.get(eid)!;
        // Sprite ID or element color changed — rebuild
        if (entry.spriteId !== spriteId || (spriteId === 1 && entry.elementColor !== elementColor)) {
          this.container.removeChild(entry.display);
          entry.display.destroy();
          const { display, isText } = this.buildDisplayFor(spriteId, elementColor, accentColor, eid);
          display.zIndex = Sprite.zLayer[eid];
          entry.display = display;
          entry.spriteId = spriteId;
          entry.elementColor = elementColor;
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

    // Remove deleted entities
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
        entry.healthBar.clear();
        const w = 32;
        entry.healthBar.roundRect(-w / 2, 0, w, 4, 1);
        entry.healthBar.fill({ color: 0x000000, alpha: 0.6 });
        entry.healthBar.stroke({ color: 0x000000, alpha: 0.8, width: 0.5 });
        const fgWidth = Math.max(0, (w - 1) * ratio);
        if (fgWidth > 0) {
          entry.healthBar.roundRect(-w / 2 + 0.5, 0.5, fgWidth, 3, 1);
          let color = 0x40ff40;
          if (ratio < 0.5) color = 0xffe040;
          if (ratio < 0.25) color = 0xff4040;
          entry.healthBar.fill({ color });
        }
        entry.healthBar.y = -36;
        entry.healthBar.x = 0;
      }

      // Update damage number text + fade
      if (entry.text && hasComponent(world, DamageNumber, eid)) {
        const val = Math.round(DamageNumber.value[eid]);
        entry.text.text = val > 0 ? String(val) : "✦";
        const age = DamageNumber.age[eid];
        const ttl = DamageNumber.ttl[eid];
        const t = age / ttl;
        entry.text.alpha = 1 - t * t;
        entry.text.scale.set(1 + t * 0.3);
      }

      // Fade out essence shards near end of lifetime
      if (hasComponent(world, Lifetime, eid) && entry.spriteId === 3) {
        const remaining = Lifetime.remaining[eid];
        if (remaining < 2) {
          const pulse = 0.5 + 0.5 * Math.sin(remaining * 12);
          disp.alpha = (remaining / 2) * (0.5 + 0.5 * pulse);
        } else {
          disp.alpha = 1;
        }
      }

      // Pulse projectiles
      if (entry.spriteId === 1) {
        const t = performance.now() / 100;
        disp.scale.set(0.9 + 0.15 * Math.sin(t));
      }
    }

    // ── Lingering Area VFX ─────────────────────────────────────────────
    this.syncLingeringAreas();

    // ── Devour VFX ─────────────────────────────────────────────────────
    this.syncDevourVfx();

    // ── Beam VFX ───────────────────────────────────────────────────────
    this.syncBeams();

    // ── Nova ring VFX ──────────────────────────────────────────────────
    this.syncNovas();

    // Sort by Y (depth)
    this.container.children.sort((a, b) => a.y - b.y);
  }

  /**
   * Sync Devour VFX. Each Devour cast spawns an expanding purple ring that
   * fades over 0.6s. Drawn as a multi-stroke ring with a purple color.
   */
  private syncDevourVfx() {
    // Query for sprite ID 7 entities (Devour VFX) with Lifetime
    const spriteQuery = defineQuery([Position, Sprite, Lifetime]);
    const allSprites = spriteQuery(world);
    const devourVfxIds = allSprites.filter((eid) => Sprite.spriteId[eid] === 7);
    const currentSet = new Set(devourVfxIds);

    // Remove deleted VFX
    for (const [eid, gfx] of this.devourVfxGraphics.entries()) {
      if (!currentSet.has(eid)) {
        this.container.removeChild(gfx);
        gfx.destroy();
        this.devourVfxGraphics.delete(eid);
      }
    }

    // Add or update VFX
    for (let i = 0; i < devourVfxIds.length; i++) {
      const eid = devourVfxIds[i];
      let gfx = this.devourVfxGraphics.get(eid);
      if (!gfx) {
        gfx = new Graphics();
        gfx.zIndex = 4;
        this.container.addChild(gfx);
        this.devourVfxGraphics.set(eid, gfx);
      }

      const cx = Position.x[eid];
      const cy = Position.y[eid];
      const remaining = Lifetime.remaining[eid];
      // Expand from 20px to 160px over 0.6s
      const progress = 1 - remaining / 0.6;
      const r = 20 + progress * 140;
      const alpha = remaining / 0.6;

      gfx.clear();
      // Outer glow
      gfx.circle(cx, cy, r);
      gfx.stroke({ color: 0x9040ff, width: 16, alpha: alpha * 0.3 });
      // Mid ring
      gfx.circle(cx, cy, r);
      gfx.stroke({ color: 0xd0a0ff, width: 6, alpha: alpha * 0.7 });
      // Core ring
      gfx.circle(cx, cy, r);
      gfx.stroke({ color: 0xffffff, width: 2, alpha: alpha });
      // Inner fill (faint)
      gfx.circle(cx, cy, r * 0.8);
      gfx.fill({ color: 0x9040ff, alpha: alpha * 0.1 });
    }
  }

  /**
   * Sync lingering area VFX. Each area is drawn as a translucent colored circle
   * that pulses and fades as its lifetime decreases.
   */
  private syncLingeringAreas() {
    const lingeringQuery = defineQuery([Position, LingeringArea, Lifetime]);
    const areas = lingeringQuery(world);
    const currentSet = new Set(areas);

    // Remove deleted areas
    for (const [eid, gfx] of this.lingeringGraphics.entries()) {
      if (!currentSet.has(eid)) {
        this.container.removeChild(gfx);
        gfx.destroy();
        this.lingeringGraphics.delete(eid);
      }
    }

    // Add or update areas
    for (let i = 0; i < areas.length; i++) {
      const eid = areas[i];
      let gfx = this.lingeringGraphics.get(eid);
      if (!gfx) {
        gfx = new Graphics();
        gfx.zIndex = 1;
        this.container.addChild(gfx);
        this.lingeringGraphics.set(eid, gfx);
      }

      const cx = Position.x[eid];
      const cy = Position.y[eid];
      const r = LingeringArea.radius[eid];
      const color = LingeringArea.color[eid];
      const remaining = Lifetime.remaining[eid];
      const alpha = Math.min(0.6, (remaining / 2) * 0.6);

      gfx.clear();
      // Outer aura
      gfx.circle(cx, cy, r);
      gfx.fill({ color, alpha: alpha * 0.3 });
      // Inner ring
      gfx.circle(cx, cy, r * 0.7);
      gfx.fill({ color, alpha: alpha * 0.5 });
      // Animated pulse
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
      gfx.circle(cx, cy, r * 0.3 * pulse);
      gfx.fill({ color: 0xffffff, alpha: alpha * 0.4 });
    }
  }

  /**
   * Sync beam VFX. Beams are short-lived line effects (0.15s).
   */
  private syncBeams() {
    const beams = beamQuery(world);
    const currentSet = new Set(beams);

    // Remove deleted beams
    for (const [eid, gfx] of this.beamGraphics.entries()) {
      if (!currentSet.has(eid)) {
        this.container.removeChild(gfx);
        gfx.destroy();
        this.beamGraphics.delete(eid);
      }
    }

    // Add or update beams
    for (let i = 0; i < beams.length; i++) {
      const eid = beams[i];
      let gfx = this.beamGraphics.get(eid);
      if (!gfx) {
        gfx = new Graphics();
        gfx.zIndex = 3;
        this.container.addChild(gfx);
        this.beamGraphics.set(eid, gfx);
      }

      const startX = Beam.startX[eid];
      const startY = Beam.startY[eid];
      const endX = Beam.endX[eid];
      const endY = Beam.endY[eid];
      const color = Beam.color[eid];
      const age = Beam.age[eid];
      const ttl = Beam.ttl[eid];
      const t = age / ttl;

      gfx.clear();
      // Outer glow
      gfx.moveTo(startX, startY);
      gfx.lineTo(endX, endY);
      gfx.stroke({ color, width: 14, alpha: (1 - t) * 0.3 });
      // Mid
      gfx.moveTo(startX, startY);
      gfx.lineTo(endX, endY);
      gfx.stroke({ color, width: 6, alpha: (1 - t) * 0.7 });
      // Core
      gfx.moveTo(startX, startY);
      gfx.lineTo(endX, endY);
      gfx.stroke({ color: 0xffffff, width: 2, alpha: 1 - t });
    }
  }

  /**
   * Sync nova ring VFX. Each nova is drawn as an expanding ring.
   */
  private syncNovas() {
    const novas = novaQuery(world);
    const currentSet = new Set(novas);

    // Remove deleted novas
    for (const [eid, gfx] of this.novaGraphics.entries()) {
      if (!currentSet.has(eid)) {
        this.container.removeChild(gfx);
        gfx.destroy();
        this.novaGraphics.delete(eid);
      }
    }

    // Add or update novas
    for (let i = 0; i < novas.length; i++) {
      const eid = novas[i];
      let gfx = this.novaGraphics.get(eid);
      if (!gfx) {
        gfx = new Graphics();
        gfx.zIndex = 3;
        this.container.addChild(gfx);
        this.novaGraphics.set(eid, gfx);
      }

      const cx = Position.x[eid];
      const cy = Position.y[eid];
      const r = NovaRing.currentRadius[eid];
      const maxR = NovaRing.maxRadius[eid];
      const color = NovaRing.color[eid];
      const fadeT = Math.min(1, r / maxR);

      gfx.clear();
      // Outer glow ring
      gfx.circle(cx, cy, r);
      gfx.stroke({ color, width: 12, alpha: (1 - fadeT) * 0.3 });
      // Mid ring
      gfx.circle(cx, cy, r);
      gfx.stroke({ color, width: 5, alpha: (1 - fadeT) * 0.7 });
      // Inner core ring
      gfx.circle(cx, cy, r);
      gfx.stroke({ color: 0xffffff, width: 1.5, alpha: 1 - fadeT });
    }
  }
}
