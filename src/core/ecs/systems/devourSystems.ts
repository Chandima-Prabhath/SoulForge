/**
 * Devour System — Rimuru's signature power, mechanically formalized.
 *
 * Phase 3 core loop:
 *   1. Kill enemy → enemy leaves [Essence Shard] with enemyTypeId
 *   2. Player walks near shard → auto-devour (within 40px)
 *   3. On devour: roll against enemy type's devourDrops
 *   4. If a new atom is unlocked → spawn VoiceOfTheWorld notification
 *   5. Track unlocked atoms in DevourProgress bitmasks
 *
 * Active [Devour] skill (slot 4):
 *   - AOE around player (120px radius)
 *   - Instantly devours all essence shards in range
 *   - Also kills any enemy with HP < 25% (execute threshold)
 *   - 8 second cooldown
 *
 * This is the path-dependent growth mechanism (README §5 Layer 3):
 *   "Two players, same realm, same seed, same starting kit. Player A walks
 *    north, meets a Frost Wolf, devours Frost. Player B walks south, meets
 *    a Fire Slime, devours Fire. Their builds diverge based on encounter order."
 */

import { addEntity, addComponent, defineQuery, hasComponent, removeEntity, entityExists } from "bitecs";
import {
  world,
  Position,
  Sprite,
  PlayerTag,
  Health,
  Hitbox,
  Team,
  Lifetime,
  EssenceShard,
  EnemyAI,
  EnemyType,
  DevourProgress,
  VoiceOfTheWorld,
  Cooldown,
} from "../world";
import { ENEMY_TYPES } from "../../../data/enemies";
import { ELEMENTS, FORMS, VECTORS, MODIFIERS } from "../../../data/grammar";
import type { AtomType } from "../../../data/enemies";
import { spawnDamageNumber, handleDeath } from "./combatSystems";

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

const playerQuery = defineQuery([PlayerTag, Position, DevourProgress, Cooldown]);
const essenceQuery = defineQuery([Position, EssenceShard]);
const enemyQuery = defineQuery([Position, Hitbox, Health, Team, EnemyAI, EnemyType]);
const voiceQuery = defineQuery([VoiceOfTheWorld]);

// ─────────────────────────────────────────────────────────────────────────────
// Atom unlock helpers — bitmask operations
// ─────────────────────────────────────────────────────────────────────────────

/** Starting unlocked atoms: Force element, Projectile form, Ranged vector. */
export const STARTING_ELEMENTS = 0b00001; // bit 0 = Force
export const STARTING_FORMS = 0b00001; // bit 0 = Projectile
export const STARTING_VECTORS = 0b00001; // bit 0 = Ranged
export const STARTING_MODIFIERS = 0b00000; // no modifiers unlocked at start

function isAtomUnlocked(progress: number, atomId: number): boolean {
  return (progress & (1 << atomId)) !== 0;
}

function unlockAtom(progress: number, atomId: number): number {
  return progress | (1 << atomId);
}

/**
 * Attempt to unlock an atom. Returns true if this is a NEW unlock (false if already had it).
 */
function tryUnlock(
  pid: number,
  type: AtomType,
  atomId: number
): boolean {
  let wasNew = false;
  switch (type) {
    case "element":
      if (!isAtomUnlocked(DevourProgress.unlockedElements[pid], atomId)) {
        DevourProgress.unlockedElements[pid] = unlockAtom(DevourProgress.unlockedElements[pid], atomId);
        wasNew = true;
      }
      break;
    case "form":
      if (!isAtomUnlocked(DevourProgress.unlockedForms[pid], atomId)) {
        DevourProgress.unlockedForms[pid] = unlockAtom(DevourProgress.unlockedForms[pid], atomId);
        wasNew = true;
      }
      break;
    case "vector":
      if (!isAtomUnlocked(DevourProgress.unlockedVectors[pid], atomId)) {
        DevourProgress.unlockedVectors[pid] = unlockAtom(DevourProgress.unlockedVectors[pid], atomId);
        wasNew = true;
      }
      break;
    case "modifier":
      if (!isAtomUnlocked(DevourProgress.unlockedModifiers[pid], atomId)) {
        DevourProgress.unlockedModifiers[pid] = unlockAtom(DevourProgress.unlockedModifiers[pid], atomId);
        wasNew = true;
      }
      break;
  }
  return wasNew;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice of the World — notification spawning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawn a Voice of the World notification.
 * The renderer reads these and shows transient messages.
 */
export function spawnVoiceOfTheWorld(
  messageId: number,
  priority: number = 1,
  atomType: number = 0,
  atomId: number = 0
) {
  const eid = addEntity(world);
  addComponent(world, VoiceOfTheWorld, eid);
  addComponent(world, Lifetime, eid);

  VoiceOfTheWorld.age[eid] = 0;
  VoiceOfTheWorld.ttl[eid] = priority >= 2 ? 5.0 : 3.5;
  VoiceOfTheWorld.priority[eid] = priority;
  VoiceOfTheWorld.messageId[eid] = messageId;
  VoiceOfTheWorld.atomType[eid] = atomType;
  VoiceOfTheWorld.atomId[eid] = atomId;
  Lifetime.remaining[eid] = VoiceOfTheWorld.ttl[eid];
}

// ─────────────────────────────────────────────────────────────────────────────
// Devour logic — consume an essence shard, roll for atom unlocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devour an essence shard. Called by auto-devour (proximity) and active Devour skill.
 * Returns true if any new atom was unlocked.
 */
function devourShard(pid: number, shardEid: number): boolean {
  if (!entityExists(world, shardEid)) return false;
  if (EssenceShard.devoured[shardEid] === 1) return false;

  const enemyTypeId = EssenceShard.enemyTypeId[shardEid];
  const enemyType = ENEMY_TYPES[enemyTypeId];
  if (!enemyType) {
    // Unknown enemy type — just consume the shard
    EssenceShard.devoured[shardEid] = 1;
    removeEntity(world, shardEid);
    return false;
  }

  // Mark as devoured and remove
  EssenceShard.devoured[shardEid] = 1;
  removeEntity(world, shardEid);

  // Increment devour counter
  DevourProgress.totalDevoured[pid] += 1;

  // Roll for each drop
  let anyNewUnlock = false;
  for (const drop of enemyType.devourDrops) {
    if (Math.random() > drop.chance) continue;
    const isNew = tryUnlock(pid, drop.type, drop.id as number);
    if (isNew) {
      anyNewUnlock = true;
      // Spawn a Voice of the World notification for this unlock
      const atomName = getAtomName(drop.type, drop.id as number);
      const messageId = getUnlockMessageId(drop.type);
      spawnVoiceOfTheWorld(messageId, 1, atomTypeToInt(drop.type), drop.id as number);
      // Log to console for debugging
      console.log(
        `%c[Voice of the World] %c${atomName} %cunlocked!`,
        "color: #ffb86c; font-weight: bold;",
        "color: #e0e0e8; font-weight: bold;",
        "color: #8888a0;"
      );
    }
  }

  return anyNewUnlock;
}

function getAtomName(type: AtomType, id: number): string {
  switch (type) {
    case "element": return ELEMENTS[id as 0 | 1 | 2 | 3 | 4].name;
    case "form": return FORMS[id as 0 | 1 | 2].name;
    case "vector": return VECTORS[id as 0 | 1 | 2].name;
    case "modifier": return MODIFIERS[id as 0 | 1 | 2 | 3 | 4].name;
  }
}

function atomTypeToInt(type: AtomType): number {
  switch (type) {
    case "element": return 1;
    case "form": return 2;
    case "vector": return 3;
    case "modifier": return 4;
  }
}

function getUnlockMessageId(type: AtomType): number {
  // Message IDs:
  //   0 = "Essence devoured."
  //   1 = "New element unlocked: {name}"
  //   2 = "New form unlocked: {name}"
  //   3 = "New vector unlocked: {name}"
  //   4 = "New modifier unlocked: {name}"
  //   5 = "Analysis complete."
  //   6 = "[Devour] activated."
  switch (type) {
    case "element": return 1;
    case "form": return 2;
    case "vector": return 3;
    case "modifier": return 4;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Devour System — proximity-based devour
//
// When the player walks within AUTO_DEVOUR_RANGE of an essence shard,
// it's automatically devoured. This is the passive path-dependent growth
// mechanism — the player doesn't need to press anything, just explore.
// ─────────────────────────────────────────────────────────────────────────────

const AUTO_DEVOUR_RANGE = 50; // pixels

export function autoDevourSystem() {
  const players = playerQuery(world);
  if (players.length === 0) return;
  const pid = players[0];
  const px = Position.x[pid];
  const py = Position.y[pid];

  const shards = essenceQuery(world);
  for (let i = 0; i < shards.length; i++) {
    const sid = shards[i];
    if (EssenceShard.devoured[sid] === 1) continue;
    const dx = Position.x[sid] - px;
    const dy = Position.y[sid] - py;
    const dist = Math.hypot(dx, dy);
    if (dist < AUTO_DEVOUR_RANGE) {
      devourShard(pid, sid);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Active [Devour] Skill — AOE devour + execute weak enemies
//
// When cast (slot 4):
//   1. Devours ALL essence shards within DEVOUR_SKILL_RANGE
//   2. Instantly kills any enemy with HP < 25% (execute threshold)
//      within DEVOUR_SKILL_RANGE — drops their essence shard too
//   3. Spawns a visual VFX (DevourRing) — handled by renderer
//   4. 8 second cooldown
// ─────────────────────────────────────────────────────────────────────────────

const DEVOUR_SKILL_RANGE = 140;
const DEVOUR_SKILL_COOLDOWN = 8.0;
const EXECUTE_THRESHOLD = 0.25; // 25% HP

export interface DevourCastRequest {
  active: boolean;
}

export function devourSkillSystem(_dt: number, cast: DevourCastRequest): boolean {
  if (!cast.active) return false;

  const players = playerQuery(world);
  if (players.length === 0) return false;
  const pid = players[0];

  // Use the generic Cooldown component for Devour (separate from skill slots)
  // Cooldown.current is decremented by cooldownSystem in combatSystems
  if (Cooldown.current[pid] > 0) return false;

  // Start cooldown
  Cooldown.current[pid] = DEVOUR_SKILL_COOLDOWN;
  Cooldown.max[pid] = DEVOUR_SKILL_COOLDOWN;

  const px = Position.x[pid];
  const py = Position.y[pid];

  // 1. Devour all essence shards in range
  const shards = essenceQuery(world);
  let shardsDevoured = 0;
  for (let i = 0; i < shards.length; i++) {
    const sid = shards[i];
    if (EssenceShard.devoured[sid] === 1) continue;
    const dx = Position.x[sid] - px;
    const dy = Position.y[sid] - py;
    const dist = Math.hypot(dx, dy);
    if (dist < DEVOUR_SKILL_RANGE) {
      devourShard(pid, sid);
      shardsDevoured++;
    }
  }

  // 2. Execute weak enemies in range
  const enemies = enemyQuery(world);
  let enemiesExecuted = 0;
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i];
    if (Team.id[eid] === 0) continue; // friendly
    if (Health.current[eid] <= 0) continue;

    const dx = Position.x[eid] - px;
    const dy = Position.y[eid] - py;
    const dist = Math.hypot(dx, dy);
    if (dist > DEVOUR_SKILL_RANGE) continue;

    const hpRatio = Health.current[eid] / Health.max[eid];
    if (hpRatio < EXECUTE_THRESHOLD) {
      // Execute! Drop essence and kill
      Health.current[eid] = 0;
      handleDeath(eid);
      enemiesExecuted++;
    } else {
      // Not weak enough — just deal some damage (25% of max HP)
      const dmg = Health.max[eid] * 0.25;
      Health.current[eid] = Math.max(0, Health.current[eid] - dmg);
      spawnDamageNumber(Position.x[eid], Position.y[eid] - 10, dmg, false);
      if (Health.current[eid] <= 0) {
        handleDeath(eid);
        enemiesExecuted++;
      }
    }
  }

  // 3. Spawn notification
  if (shardsDevoured > 0 || enemiesExecuted > 0) {
    spawnVoiceOfTheWorld(6, 2); // "[Devour] activated."
    console.log(
      `%c[Devour] %cDevoured ${shardsDevoured} shards, executed ${enemiesExecuted} enemies.`,
      "color: #ffb86c; font-weight: bold;",
      "color: #e0e0e8;"
    );
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice of the World System — ages notifications, despawns expired ones
// ─────────────────────────────────────────────────────────────────────────────

export function voiceOfTheWorldSystem(dt: number) {
  const voices = voiceQuery(world);
  for (let i = 0; i < voices.length; i++) {
    const eid = voices[i];
    VoiceOfTheWorld.age[eid] += dt;
  }
  // Despawn is handled by lifetimeSystem (VoiceOfTheWorld entities have Lifetime)
}

// ─────────────────────────────────────────────────────────────────────────────
// Player spawner helper — adds DevourProgress + EnemyType to player
//
// Call this AFTER spawnPlayerWithSkills() to add Phase 3 components.
// ─────────────────────────────────────────────────────────────────────────────

export function addDevourProgressToPlayer(pid: number) {
  if (!hasComponent(world, DevourProgress, pid)) {
    addComponent(world, DevourProgress, pid);
  }
  DevourProgress.unlockedElements[pid] = STARTING_ELEMENTS;
  DevourProgress.unlockedForms[pid] = STARTING_FORMS;
  DevourProgress.unlockedVectors[pid] = STARTING_VECTORS;
  DevourProgress.unlockedModifiers[pid] = STARTING_MODIFIERS;
  DevourProgress.totalDevoured[pid] = 0;
}

/**
 * Add EnemyType to an enemy entity. Call after spawnEnemy().
 */
export function setEnemyType(eid: number, typeId: number) {
  if (!hasComponent(world, EnemyType, eid)) {
    addComponent(world, EnemyType, eid);
  }
  EnemyType.typeId[eid] = typeId;

  // Apply type-specific stats
  const typeDef = ENEMY_TYPES[typeId];
  if (typeDef) {
    Health.max[eid] = typeDef.hp;
    Health.current[eid] = typeDef.hp;
    EnemyAI.aggroRange[eid] = typeDef.aggroRange;
    EnemyAI.attackRange[eid] = typeDef.attackRange;
    EnemyAI.attackCooldown[eid] = typeDef.attackCooldown;
  }
}

/**
 * Spawn an essence shard for a specific enemy type.
 * Called by handleDeath() — but since handleDeath is in combatSystems and
 * doesn't know about enemy types, we override the spawn here.
 *
 * Actually, for Phase 3, we'll modify handleDeath to check for EnemyType
 * and pass the type ID to the shard. For now, this is a manual spawn
 * used by the Devour skill's execute path.
 */
export function spawnTypedEssenceShard(
  x: number,
  y: number,
  enemyTypeId: number,
  value: number = 1
) {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, EssenceShard, eid);
  addComponent(world, Lifetime, eid);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Sprite.spriteId[eid] = 3;
  Sprite.zLayer[eid] = 1;
  EssenceShard.value[eid] = value;
  EssenceShard.enemyTypeId[eid] = enemyTypeId;
  EssenceShard.devoured[eid] = 0;
  Lifetime.remaining[eid] = 12; // 12 seconds to devour before it fades
}

/**
 * Get a summary of the player's devour progress (for HUD display).
 */
export function getDevourProgressSummary(pid: number): {
  elements: string[];
  forms: string[];
  vectors: string[];
  modifiers: string[];
  totalDevoured: number;
} {
  const elements: string[] = [];
  const forms: string[] = [];
  const vectors: string[] = [];
  const modifiers: string[] = [];

  for (let i = 0; i < 5; i++) {
    if (isAtomUnlocked(DevourProgress.unlockedElements[pid], i)) {
      elements.push(ELEMENTS[i as 0 | 1 | 2 | 3 | 4].name);
    }
  }
  for (let i = 0; i < 3; i++) {
    if (isAtomUnlocked(DevourProgress.unlockedForms[pid], i)) {
      forms.push(FORMS[i as 0 | 1 | 2].name);
    }
  }
  for (let i = 0; i < 3; i++) {
    if (isAtomUnlocked(DevourProgress.unlockedVectors[pid], i)) {
      vectors.push(VECTORS[i as 0 | 1 | 2].name);
    }
  }
  for (let i = 0; i < 5; i++) {
    if (isAtomUnlocked(DevourProgress.unlockedModifiers[pid], i)) {
      modifiers.push(MODIFIERS[i as 0 | 1 | 2 | 3 | 4].name);
    }
  }

  return {
    elements,
    forms,
    vectors,
    modifiers,
    totalDevoured: DevourProgress.totalDevoured[pid],
  };
}
