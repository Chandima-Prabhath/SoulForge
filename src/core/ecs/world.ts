/**
 * ECS World & Components — pure TypeScript, no rendering dependencies.
 *
 * This is the foundation of the Game Core. It must remain engine-agnostic
 * so it can run identically in browser, Node, and (later) on a Colyseus server.
 *
 * Phase 0: foundation (Position, Velocity, Sprite, PlayerTag, CameraTargetTag, MoveTarget)
 * Phase 1: combat (Health, Hitbox, Team, Projectile, Lifetime, Facing, Cooldown, EnemyAI)
 *
 * bitECS pattern: the world is just an entity manager. Components are
 * standalone typed arrays. Systems query components directly.
 */

import { createWorld, defineComponent, Types, type IWorld } from "bitecs";

export const world = createWorld();

// ─────────────────────────────────────────────────────────────────────────────
// Phase 0 — Foundation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * World-space pixel position.
 * Origin (0,0) is the top-left corner of the tilemap's bounding box.
 */
export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

/**
 * Velocity in pixels per second.
 */
export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

/**
 * Sprite reference — just an integer ID into the renderer's sprite registry.
 * The renderer resolves this ID to an actual Pixi display object.
 * Game Core never touches Pixi.
 */
export const Sprite = defineComponent({
  spriteId: Types.ui8, // index into SpriteRegistry
  zLayer: Types.ui8, // 0 = ground, 1 = object, 2 = character, 3 = vfx
});

/**
 * Marks an entity as the player. Tag component (no data).
 */
export const PlayerTag = defineComponent({});

/**
 * Marks an entity for the camera to follow. Tag component.
 */
export const CameraTargetTag = defineComponent({});

/**
 * Click-to-move target. When active, the movement system steers toward this point.
 * The `active` flag distinguishes "no target" from "target at (0,0)".
 */
export const MoveTarget = defineComponent({
  x: Types.f32,
  y: Types.f32,
  active: Types.ui8, // 0 = inactive, 1 = active
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 — Combat
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Health — current and max HP.
 * When current hits 0, the entity dies (handled by combatSystem).
 */
export const Health = defineComponent({
  current: Types.f32,
  max: Types.f32,
});

/**
 * Circular hitbox (radius in pixels). Used for projectile collision and melee.
 */
export const Hitbox = defineComponent({
  radius: Types.f32,
});

/**
 * Team — 0 = player/friendly, 1 = enemy/hostile.
 * Projectiles only damage entities on the opposite team.
 */
export const Team = defineComponent({
  id: Types.ui8, // 0 = player, 1 = enemy
});

/**
 * Projectile — traveling damage carrier. Owns its damage value, lifetime,
 * and team so it only hits enemies of the opposing team.
 */
export const Projectile = defineComponent({
  damage: Types.f32,
  teamId: Types.ui8, // team that fired it; hits the OTHER team
  pierceCount: Types.ui8, // how many more enemies it can hit before despawning
});

/**
 * Lifetime — seconds remaining before the entity auto-despawns.
 * Used for projectiles, damage numbers, VFX.
 * When lifetime reaches 0, the entity is removed.
 */
export const Lifetime = defineComponent({
  remaining: Types.f32,
});

/**
 * Facing — normalized direction the entity is looking.
 * Updated by the facing system based on Velocity (or last movement).
 * Used to aim Mana Bolt when no explicit target is given.
 */
export const Facing = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

/**
 * Cooldown — generic ability cooldown. One per entity (Phase 1 only has Mana Bolt).
 * In Phase 2+ we'll have per-ability cooldowns.
 */
export const Cooldown = defineComponent({
  current: Types.f32, // seconds remaining (0 = ready)
  max: Types.f32, // total cooldown duration
});

/**
 * EnemyAI — state machine for enemy behavior.
 *   0 = idle (wander or stand)
 *   1 = chase (move toward player)
 *   2 = attack (in melee range, attacking)
 *   3 = dead (pending cleanup)
 */
export const EnemyAI = defineComponent({
  state: Types.ui8,
  aggroRange: Types.f32, // distance at which enemy notices player
  attackRange: Types.f32, // distance at which enemy attacks
  attackCooldown: Types.f32, // seconds between attacks
  attackTimer: Types.f32, // current attack timer
  wanderTimer: Types.f32, // for idle wandering
  wanderDx: Types.f32,
  wanderDy: Types.f32,
});

/**
 * DamageNumber — floating combat text. Purely visual but driven by ECS
 * so the renderer can pick it up uniformly with everything else.
 */
export const DamageNumber = defineComponent({
  value: Types.f32,
  age: Types.f32, // seconds since spawned
  ttl: Types.f32, // total lifetime
});

/**
 * EssenceShard — drops from dead enemies. Placeholder for Phase 3 (Devour system).
 * Phase 1: just spawns visually so we can see the kill registered something.
 */
export const EssenceShard = defineComponent({
  value: Types.f32,
});

export type World = IWorld;
