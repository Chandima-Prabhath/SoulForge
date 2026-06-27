/**
 * Skill Execution System — pure simulation, no rendering.
 *
 * This is the heart of SoulForge's compositional skill grammar. Given a
 * SkillDefinition, it spawns the appropriate entities (Projectile, Beam,
 * NovaRing) with stats derived from the grammar atoms.
 *
 * Per README §4.1:
 *   Element  → drives color + damage type + status effect
 *   Form     → drives geometry (Projectile vs Beam vs Nova)
 *   Vector   → drives targeting (Ranged vs Self vs Cone)
 *   Modifier → drives stackable traits (Pierce, Split, Linger, Chain, Grow)
 *
 * The execution system NEVER reads or writes to PixiJS. It only writes
 * ECS components. The renderer reads those components to draw VFX.
 */

import { addEntity, addComponent, defineQuery, hasComponent } from "bitecs";
import {
  world,
  Position,
  Velocity,
  Sprite,
  PlayerTag,
  MoveTarget,
  Health,
  Hitbox,
  Team,
  Projectile,
  Lifetime,
  Facing,
  Cooldown,
  EnemyAI,
  SkillSlot,
  StatusEffect,
  Beam,
  NovaRing,
  CameraTargetTag,
} from "../world";
import type { SkillDefinition, SkillStats } from "../../grammar/types";
import { computeSkillStats } from "../../grammar/compute";
import { STARTER_SKILLS } from "../../../data/grammar";
import { spawnDamageNumber, handleDeath } from "./combatSystems";

// ─────────────────────────────────────────────────────────────────────────────
// Player's owned skills — a runtime array indexed by SkillSlot.skillIndex
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The player's owned skills. SkillSlot.skillIndex[N] indexes into this array.
 * Phase 2: starts with the 3 starter skills. Phase 5 will allow crafting new ones.
 */
export const playerSkills: SkillDefinition[] = [...STARTER_SKILLS];

/**
 * Cached stats per skill index — recomputed only when the skill changes.
 */
const playerSkillStatsCache: SkillStats[] = STARTER_SKILLS.map(computeSkillStats);

export function getSkillStats(slotIndex: number): SkillStats | null {
  return playerSkillStatsCache[slotIndex] ?? null;
}

export function getSkill(slotIndex: number): SkillDefinition | null {
  return playerSkills[slotIndex] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

const playerQuery = defineQuery([PlayerTag, Position, Facing, SkillSlot]);
const beamQuery = defineQuery([Beam]);
const novaQuery = defineQuery([NovaRing, Position]);

// ─────────────────────────────────────────────────────────────────────────────
// Public API: cast a skill from a slot
//
// Returns true if the cast happened, false otherwise (off cooldown, etc).
// ─────────────────────────────────────────────────────────────────────────────

export interface CastRequest {
  /** 0..3 — which skill slot to cast. */
  slot: number;
  /** World-space target point (used for Ranged vector; ignored for Self). */
  targetX: number;
  targetY: number;
  /** Whether the cast is actually requested this frame. */
  active: boolean;
}

export function castSkillSystem(_dt: number, cast: CastRequest): boolean {
  if (!cast.active) return false;

  const players = playerQuery(world);
  if (players.length === 0) return false;
  const pid = players[0];

  const slot = cast.slot;
  if (slot < 0 || slot > 3) return false;

  // Read slot fields — bitECS stores them as skillIndex0..3, cd0..3
  const skillIndex = readSkillIndex(pid, slot);
  if (skillIndex < 0) return false;

  const cd = readCooldown(pid, slot);
  if (cd > 0) return false;

  const stats = getSkillStats(skillIndex);
  const skillDef = getSkill(skillIndex);
  if (!stats || !skillDef) return false;

  // ── Dispatch by Form ────────────────────────────────────────────────────
  switch (skillDef.form) {
    case 0: spawnProjectileCast(pid, cast, stats, skillDef); break;
    case 1: spawnBeamCast(pid, cast, stats, skillDef); break;
    case 2: spawnNovaCast(pid, cast, stats, skillDef); break;
  }

  // Start cooldown on this slot
  writeCooldown(pid, slot, stats.cooldown);

  // Casting cancels click-to-move (so you can kite)
  if (hasComponent(world, MoveTarget, pid)) {
    MoveTarget.active[pid] = 0;
  }
  Velocity.x[pid] = 0;
  Velocity.y[pid] = 0;

  // Update facing toward target (for Ranged/Cone)
  const dx = cast.targetX - Position.x[pid];
  const dy = cast.targetY - Position.y[pid];
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    Facing.x[pid] = dx / dist;
    Facing.y[pid] = dy / dist;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form 0: Projectile — a single traveling bolt
// ─────────────────────────────────────────────────────────────────────────────

function spawnProjectileCast(
  pid: number,
  cast: CastRequest,
  stats: SkillStats,
  skill: SkillDefinition
) {
  const px = Position.x[pid];
  const py = Position.y[pid];

  // Compute direction based on Vector
  let dirX: number, dirY: number;
  if (skill.vector === 1) {
    // Self — no direction; Projectile + Self doesn't really make sense.
    // Fall back to facing direction.
    dirX = Facing.x[pid];
    dirY = Facing.y[pid];
  } else {
    // Ranged or Cone — aim toward target
    const dx = cast.targetX - px;
    const dy = cast.targetY - py;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      dirX = Facing.x[pid];
      dirY = Facing.y[pid];
    } else {
      dirX = dx / dist;
      dirY = dy / dist;
    }
  }

  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, Projectile, eid);
  addComponent(world, Lifetime, eid);
  addComponent(world, Hitbox, eid);
  addComponent(world, Team, eid);

  // Spawn slightly ahead of the caster so it doesn't collide with them
  Position.x[eid] = px + dirX * 16;
  Position.y[eid] = py + dirY * 16;
  Velocity.x[eid] = dirX * stats.speed;
  Velocity.y[eid] = dirY * stats.speed;
  Sprite.spriteId[eid] = 1; // 1 = projectile (renderer styles by elementId)
  Sprite.zLayer[eid] = 3;
  Projectile.damage[eid] = stats.damage;
  Projectile.teamId[eid] = 0;
  Projectile.pierceCount[eid] = stats.pierceCount;
  Projectile.color[eid] = stats.color;
  Projectile.accentColor[eid] = stats.accentColor;
  Projectile.elementId[eid] = skill.element;
  if (stats.statusEffect) {
    Projectile.statusType[eid] = statusTypeToInt(stats.statusEffect.type);
    Projectile.statusDuration[eid] = stats.statusEffect.duration;
    Projectile.statusMagnitude[eid] = stats.statusEffect.magnitude;
  } else {
    Projectile.statusType[eid] = 0;
    Projectile.statusDuration[eid] = 0;
    Projectile.statusMagnitude[eid] = 0;
  }
  Lifetime.remaining[eid] = stats.lifetime;
  Hitbox.radius[eid] = stats.radius;
  Team.id[eid] = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form 1: Beam — instantaneous line damage
//
// Hits every enemy along the line from caster to target point.
// Spawns a Beam entity purely for VFX (lives 0.15s).
// ─────────────────────────────────────────────────────────────────────────────

function spawnBeamCast(
  pid: number,
  cast: CastRequest,
  stats: SkillStats,
  skill: SkillDefinition
) {
  const px = Position.x[pid];
  const py = Position.y[pid];

  let endX: number, endY: number;
  if (skill.vector === 1) {
    // Self — beam doesn't make sense; bail
    return;
  } else {
    // Ranged or Cone — beam goes toward target
    const dx = cast.targetX - px;
    const dy = cast.targetY - py;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    // Beam range is 4× the projectile lifetime × speed, capped at 600px
    const range = Math.min(600, stats.lifetime > 0 ? stats.speed * stats.lifetime * 4 : 600);
    endX = px + (dx / dist) * range;
    endY = py + (dy / dist) * range;
  }

  // Apply damage to every enemy along the line (segment-circle intersection)
  const enemies = defineQuery([Position, Hitbox, Health, Team, EnemyAI])(world);
  const beamDirX = endX - px;
  const beamDirY = endY - py;
  const beamLen = Math.hypot(beamDirX, beamDirY);
  const beamNx = beamDirX / beamLen;
  const beamNy = beamDirY / beamLen;

  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i];
    if (Team.id[eid] === 0) continue; // friendly
    if (Health.current[eid] <= 0) continue;

    const ex = Position.x[eid];
    const ey = Position.y[eid];
    // Project enemy position onto beam line
    const t = (ex - px) * beamNx + (ey - py) * beamNy;
    if (t < 0 || t > beamLen) continue;
    // Closest point on beam
    const cx = px + beamNx * t;
    const cy = py + beamNy * t;
    const distToLine = Math.hypot(ex - cx, ey - cy);
    if (distToLine < Hitbox.radius[eid] + stats.radius) {
      // HIT
      Health.current[eid] = Math.max(0, Health.current[eid] - stats.damage);
      spawnDamageNumber(ex, ey - 10, stats.damage, false);
      applyStatusEffect(eid, stats);
      if (Health.current[eid] <= 0) {
        handleDeath(eid);
      }
    }
  }

  // Spawn the beam VFX entity
  const beamEid = addEntity(world);
  addComponent(world, Beam, beamEid);
  addComponent(world, Position, beamEid);
  addComponent(world, Lifetime, beamEid);
  Beam.startX[beamEid] = px;
  Beam.startY[beamEid] = py;
  Beam.endX[beamEid] = endX;
  Beam.endY[beamEid] = endY;
  Beam.color[beamEid] = stats.color;
  Beam.age[beamEid] = 0;
  Beam.ttl[beamEid] = 0.15;
  Position.x[beamEid] = px;
  Position.y[beamEid] = py;
  Lifetime.remaining[beamEid] = 0.15;
}

// ─────────────────────────────────────────────────────────────────────────────
// Form 2: Nova — expanding ring around the caster
//
// Spawns a NovaRing entity. The novaSystem expands it each frame and
// applies damage to enemies it touches.
// ─────────────────────────────────────────────────────────────────────────────

function spawnNovaCast(
  pid: number,
  _cast: CastRequest,
  stats: SkillStats,
  skill: SkillDefinition
) {
  const px = Position.x[pid];
  const py = Position.y[pid];

  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, NovaRing, eid);
  addComponent(world, Lifetime, eid);
  addComponent(world, Team, eid);
  addComponent(world, Sprite, eid);

  Position.x[eid] = px;
  Position.y[eid] = py;
  NovaRing.maxRadius[eid] = stats.radius;
  NovaRing.currentRadius[eid] = 10;
  NovaRing.expandSpeed[eid] = stats.speed;
  NovaRing.color[eid] = stats.color;
  NovaRing.teamId[eid] = 0;
  NovaRing.damage[eid] = stats.damage;
  NovaRing.hitCount[eid] = 0;
  Lifetime.remaining[eid] = (stats.radius / stats.speed) + 0.2;
  Team.id[eid] = 0;
  Sprite.spriteId[eid] = 5; // 5 = nova ring
  Sprite.zLayer[eid] = 3;
  void skill; // skill.element would be read here for element-specific VFX
}

// ─────────────────────────────────────────────────────────────────────────────
// Nova System — expands the ring each frame, applies damage to enemies it touches
// ─────────────────────────────────────────────────────────────────────────────

const novaEnemyQuery = defineQuery([Position, Hitbox, Health, Team, EnemyAI]);

export function novaSystem(dt: number) {
  const rings = novaQuery(world);
  if (rings.length === 0) return;

  const enemies = novaEnemyQuery(world);

  for (let i = 0; i < rings.length; i++) {
    const rid = rings[i];
    NovaRing.currentRadius[rid] += NovaRing.expandSpeed[rid] * dt;

    const cx = Position.x[rid];
    const cy = Position.y[rid];
    const r = NovaRing.currentRadius[rid];
    const maxR = NovaRing.maxRadius[rid];
    const ringTeam = NovaRing.teamId[rid];
    const dmg = NovaRing.damage[rid];

    // Damage enemies whose hitbox overlaps the ring (annulus check)
    for (let j = 0; j < enemies.length; j++) {
      const eid = enemies[j];
      if (Team.id[eid] === ringTeam) continue;
      if (Health.current[eid] <= 0) continue;

      const dx = Position.x[eid] - cx;
      const dy = Position.y[eid] - cy;
      const dist = Math.hypot(dx, dy);
      const hitR = Hitbox.radius[eid];

      // Ring is "thick" — hit if within [r-10, r+10+hitR]
      if (dist >= r - 12 && dist <= r + 12 + hitR) {
        // Simple dedup: skip if hit count exceeds enemy count threshold
        // (Phase 2: just allow one hit per nova per enemy via flag in component)
        Health.current[eid] = Math.max(0, Health.current[eid] - dmg);
        spawnDamageNumber(Position.x[eid], Position.y[eid] - 10, dmg, false);
        // Apply status effect from the nova's element (read from spawn-time data — not stored separately)
        // For Phase 2 simplicity, novae apply the element's status via a stored skill index.
        // We skip status for nova in Phase 2 to avoid bloating NovaRing.
        if (Health.current[eid] <= 0) {
          handleDeath(eid);
        }
        NovaRing.hitCount[rid] += 1;
      }
    }

    // Despawn when fully expanded
    if (r >= maxR) {
      // Mark for removal — lifetime will handle it
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Beam System — ages beams, despawns expired ones
// ─────────────────────────────────────────────────────────────────────────────

export function beamSystem(dt: number) {
  const beams = beamQuery(world);
  for (let i = 0; i < beams.length; i++) {
    const eid = beams[i];
    Beam.age[eid] += dt;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Effect application + tick system
// ─────────────────────────────────────────────────────────────────────────────

function statusTypeToInt(type: "burn" | "slow" | "shock" | "drain"): number {
  switch (type) {
    case "burn": return 1;
    case "slow": return 2;
    case "shock": return 3;
    case "drain": return 4;
  }
}

function applyStatusEffect(eid: number, stats: SkillStats) {
  if (!stats.statusEffect) return;
  if (!hasComponent(world, StatusEffect, eid)) {
    addComponent(world, StatusEffect, eid);
  }
  // Find an empty slot or refresh matching type
  const types = [StatusEffect.type0, StatusEffect.type1, StatusEffect.type2, StatusEffect.type3];
  const timers = [StatusEffect.timer0, StatusEffect.timer1, StatusEffect.timer2, StatusEffect.timer3];
  const mags = [StatusEffect.mag0, StatusEffect.mag1, StatusEffect.mag2, StatusEffect.mag3];
  const typeInt = statusTypeToInt(stats.statusEffect.type);

  for (let i = 0; i < 4; i++) {
    if (types[i][eid] === typeInt || types[i][eid] === 0) {
      types[i][eid] = typeInt;
      timers[i][eid] = stats.statusEffect.duration;
      mags[i][eid] = stats.statusEffect.magnitude;
      return;
    }
  }
  // All 4 slots full — overwrite slot 0 (rare case)
  types[0][eid] = typeInt;
  timers[0][eid] = stats.statusEffect.duration;
  mags[0][eid] = stats.statusEffect.magnitude;
}

const statusQuery = defineQuery([StatusEffect, Health]);
const playerForDrainQuery = defineQuery([PlayerTag, Health]);

export function statusEffectSystem(dt: number) {
  const entities = statusQuery(world);
  const players = playerForDrainQuery(world);
  const pid = players.length > 0 ? players[0] : -1;

  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const types = [StatusEffect.type0, StatusEffect.type1, StatusEffect.type2, StatusEffect.type3];
    const timers = [StatusEffect.timer0, StatusEffect.timer1, StatusEffect.timer2, StatusEffect.timer3];
    const mags = [StatusEffect.mag0, StatusEffect.mag1, StatusEffect.mag2, StatusEffect.mag3];

    for (let s = 0; s < 4; s++) {
      if (types[s][eid] === 0) continue;
      timers[s][eid] -= dt;
      if (timers[s][eid] <= 0) {
        types[s][eid] = 0;
        timers[s][eid] = 0;
        mags[s][eid] = 0;
        continue;
      }
      // Apply per-type effect
      const type = types[s][eid];
      const mag = mags[s][eid];
      switch (type) {
        case 1: // burn — mag dmg/sec
          Health.current[eid] = Math.max(0, Health.current[eid] - mag * dt);
          break;
        case 2: // slow — handled by movement system (Phase 2: not yet wired)
          break;
        case 3: // shock — mag = damage taken increase (handled in damage application)
          break;
        case 4: // drain — heal caster for mag × damage dealt this tick
          if (pid >= 0 && hasComponent(world, Health, pid)) {
            Health.current[pid] = Math.min(
              Health.max[pid],
              Health.current[pid] + mag * 2 * dt // 2 dmg/sec nominal drain
            );
          }
          break;
      }
      if (Health.current[eid] <= 0) {
        handleDeath(eid);
        break;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SkillSlot cooldown system — decrements all 4 slot cooldowns
// ─────────────────────────────────────────────────────────────────────────────

const skillSlotQuery = defineQuery([SkillSlot]);

export function skillCooldownSystem(dt: number) {
  const entities = skillSlotQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (SkillSlot.cd0[eid] > 0) SkillSlot.cd0[eid] = Math.max(0, SkillSlot.cd0[eid] - dt);
    if (SkillSlot.cd1[eid] > 0) SkillSlot.cd1[eid] = Math.max(0, SkillSlot.cd1[eid] - dt);
    if (SkillSlot.cd2[eid] > 0) SkillSlot.cd2[eid] = Math.max(0, SkillSlot.cd2[eid] - dt);
    if (SkillSlot.cd3[eid] > 0) SkillSlot.cd3[eid] = Math.max(0, SkillSlot.cd3[eid] - dt);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for reading/writing SkillSlot fields by index
// ─────────────────────────────────────────────────────────────────────────────

function readSkillIndex(eid: number, slot: number): number {
  switch (slot) {
    case 0: return SkillSlot.skillIndex0[eid];
    case 1: return SkillSlot.skillIndex1[eid];
    case 2: return SkillSlot.skillIndex2[eid];
    case 3: return SkillSlot.skillIndex3[eid];
    default: return -1;
  }
}

function readCooldown(eid: number, slot: number): number {
  switch (slot) {
    case 0: return SkillSlot.cd0[eid];
    case 1: return SkillSlot.cd1[eid];
    case 2: return SkillSlot.cd2[eid];
    case 3: return SkillSlot.cd3[eid];
    default: return Infinity;
  }
}

function writeCooldown(eid: number, slot: number, value: number) {
  switch (slot) {
    case 0: SkillSlot.cd0[eid] = value; SkillSlot.cdMax0[eid] = value; break;
    case 1: SkillSlot.cd1[eid] = value; SkillSlot.cdMax1[eid] = value; break;
    case 2: SkillSlot.cd2[eid] = value; SkillSlot.cdMax2[eid] = value; break;
    case 3: SkillSlot.cd3[eid] = value; SkillSlot.cdMax3[eid] = value; break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Player spawner — Phase 2 version with SkillSlot
// ─────────────────────────────────────────────────────────────────────────────

export function spawnPlayerWithSkills(x: number, y: number): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, PlayerTag, eid);
  addComponent(world, CameraTargetTag, eid);
  addComponent(world, MoveTarget, eid);
  addComponent(world, Health, eid);
  addComponent(world, Hitbox, eid);
  addComponent(world, Team, eid);
  addComponent(world, Facing, eid);
  addComponent(world, Cooldown, eid);
  addComponent(world, SkillSlot, eid);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Sprite.spriteId[eid] = 0;
  Sprite.zLayer[eid] = 2;
  MoveTarget.active[eid] = 0;
  Health.current[eid] = 100;
  Health.max[eid] = 100;
  Hitbox.radius[eid] = 14;
  Team.id[eid] = 0;
  Facing.x[eid] = 0;
  Facing.y[eid] = 1;
  Cooldown.current[eid] = 0;
  Cooldown.max[eid] = 0;

  // Equip starter skills: slots 0, 1, 2 (slot 3 reserved for Devour in Phase 3)
  SkillSlot.skillIndex0[eid] = 0; // Mana Bolt
  SkillSlot.skillIndex1[eid] = 1; // Frost Nova
  SkillSlot.skillIndex2[eid] = 2; // Lightning Beam
  SkillSlot.skillIndex3[eid] = -1; // empty (Devour comes in Phase 3)
  SkillSlot.cd0[eid] = 0;
  SkillSlot.cd1[eid] = 0;
  SkillSlot.cd2[eid] = 0;
  SkillSlot.cd3[eid] = 0;
  SkillSlot.cdMax0[eid] = playerSkillStatsCache[0].cooldown;
  SkillSlot.cdMax1[eid] = playerSkillStatsCache[1].cooldown;
  SkillSlot.cdMax2[eid] = playerSkillStatsCache[2].cooldown;
  SkillSlot.cdMax3[eid] = 0;

  return eid;
}
