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
 *
 * Phase 2 additions:
 *   color       — hex color for procedural VFX (from element)
 *   accentColor — secondary color for VFX highlights
 *   statusType  — 0=none, 1=burn, 2=slow, 3=shock, 4=drain (from element)
 *   statusDuration — seconds of status effect applied on hit
 *   statusMagnitude — per-type magnitude (dmg/sec, slow%, etc.)
 *   elementId   — 0..4 (used by renderer for particle styling)
 */
export const Projectile = defineComponent({
  damage: Types.f32,
  teamId: Types.ui8, // team that fired it; hits the OTHER team
  pierceCount: Types.ui8, // how many more enemies it can hit before despawning
  // Phase 2 fields:
  color: Types.ui32,
  accentColor: Types.ui32,
  statusType: Types.ui8,
  statusDuration: Types.f32,
  statusMagnitude: Types.f32,
  elementId: Types.ui8,
  // Phase 3 fields — modifier execution:
  splitOnKill: Types.ui8,        // 1 = spawn 2 children on enemy kill
  lingerDuration: Types.f32,     // >0 = leave a damaging area on impact
  chainCount: Types.ui8,         // remaining chain bounces
  growWithDistance: Types.ui8,   // 1 = scale damage/size with travel distance
  distanceTraveled: Types.f32,   // accumulated travel distance (for Grow)
  baseDamage: Types.f32,         // original damage (for Grow scaling reference)
  baseRadius: Types.f32,         // original radius (for Grow scaling reference)
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — Skill Grammar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SkillSlot — holds the SkillDefinition for one of the player's 4 ability slots.
 * Stored as a fixed-size array of integers (because bitECS doesn't support
 * string fields). We use a parallel SkillRegistry (in core/grammar/registry.ts)
 * to look up the SkillDefinition by ID.
 *
 * Field layout:
 *   skillIndex[0..3]  — index into the player's owned skills array, or -1 if empty
 *   cooldownCurrent[0..3] — current cooldown seconds remaining
 *   cooldownMax[0..3]     — max cooldown for this skill (cached for HUD)
 *
 * Player has 4 slots. Slot 0 is reserved for [Devour] in Phase 3.
 */
export const SkillSlot = defineComponent({
  skillIndex0: Types.i32,
  skillIndex1: Types.i32,
  skillIndex2: Types.i32,
  skillIndex3: Types.i32,
  cd0: Types.f32,
  cd1: Types.f32,
  cd2: Types.f32,
  cd3: Types.f32,
  cdMax0: Types.f32,
  cdMax1: Types.f32,
  cdMax2: Types.f32,
  cdMax3: Types.f32,
});

/**
 * StatusEffect — applied to entities hit by elemental skills.
 * One component holds up to 4 simultaneous effects (one per type).
 *   type:    0 = none, 1 = burn, 2 = slow, 3 = shock, 4 = drain
 *   timer:   seconds remaining
 *   magnitude: per-type meaning (dmg/sec, slow multiplier, etc.)
 */
export const StatusEffect = defineComponent({
  type0: Types.ui8, type1: Types.ui8, type2: Types.ui8, type3: Types.ui8,
  timer0: Types.f32, timer1: Types.f32, timer2: Types.f32, timer3: Types.f32,
  mag0: Types.f32, mag1: Types.f32, mag2: Types.f32, mag3: Types.f32,
});

/**
 * Beam — instant line damage marker. Lives for 1 frame visually but the
 * damage is applied immediately on spawn. The renderer reads this to draw
 * a brief beam effect.
 */
export const Beam = defineComponent({
  startX: Types.f32,
  startY: Types.f32,
  endX: Types.f32,
  endY: Types.f32,
  color: Types.ui32,
  age: Types.f32,
  ttl: Types.f32,
});

/**
 * NovaRing — expanding ring effect. Reads radius from Projectile.radius
 * (reused). Has its own component so the renderer can draw it differently.
 */
export const NovaRing = defineComponent({
  maxRadius: Types.f32,
  currentRadius: Types.f32,
  expandSpeed: Types.f32,
  color: Types.ui32,
  teamId: Types.ui8,
  damage: Types.f32,
  /** Enemies already hit by this nova — prevents multi-hit on same frame. */
  hitCount: Types.ui8,
});

/**
 * LingeringArea — a damaging zone left at a point by the Linger modifier.
 * Damages enemies that enter it on a per-frame basis (with small per-frame
 * damage to avoid huge ticks).
 */
export const LingeringArea = defineComponent({
  damagePerSec: Types.f32,
  radius: Types.f32,
  teamId: Types.ui8,
  color: Types.ui32,
  statusType: Types.ui8,
  statusDuration: Types.f32,
  statusMagnitude: Types.f32,
  tickAccumulator: Types.f32, // accumulates dt for per-second damage application
});

export type World = IWorld;
