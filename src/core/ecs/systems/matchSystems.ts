/**
 * Match Systems — minion spawning, minion AI, structure attacks, win/lose.
 *
 * Phase 7: Match Mode logic. Separate from the roguelite realm systems.
 * The player enters match mode from a mode-select screen, plays a 10-20 min
 * match, then returns to the Sanctum with rewards.
 */

import { addEntity, addComponent, defineQuery, hasComponent, removeEntity } from "bitecs";
import {
  world,
  Position,
  Velocity,
  Sprite,
  Health,
  Hitbox,
  Team,
  Minion,
  Structure,
  MatchState,
} from "../world";
import { tileToWorld } from "../../iso";
import {
  buildMatchArena,
  MINION_TYPES,
  STRUCTURE_TYPES,
  DEFAULT_MATCH_CONFIG,
  TEAM_COLORS,
  type MatchArena,
} from "../../../data/matchData";
import { spawnDamageNumber, handleDeath } from "./combatSystems";

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

const minionQuery = defineQuery([Position, Minion, Health]);
const structureQuery = defineQuery([Position, Structure, Health]);
const matchStateQuery = defineQuery([MatchState]);

// ─────────────────────────────────────────────────────────────────────────────
// Match Arena + State
// ─────────────────────────────────────────────────────────────────────────────

let matchArena: MatchArena | null = null;

/**
 * Start a new match — build arena, spawn structures, init match state.
 */
export function startMatch() {
  matchArena = buildMatchArena();

  // Create match state entity
  const stateEid = addEntity(world);
  addComponent(world, MatchState, stateEid);
  MatchState.matchTime[stateEid] = 0;
  MatchState.waveTimer[stateEid] = DEFAULT_MATCH_CONFIG.firstWaveDelay;
  MatchState.waveCount[stateEid] = 0;
  MatchState.result[stateEid] = 0;

  // Spawn structures
  if (!matchArena) return;

  // Player towers
  for (const tower of matchArena.playerTowers) {
    spawnStructure(tower.col, tower.row, 0, "tower");
  }
  // Player core
  spawnStructure(matchArena.playerCore.col, matchArena.playerCore.row, 0, "core");

  // Enemy towers
  for (const tower of matchArena.enemyTowers) {
    spawnStructure(tower.col, tower.row, 1, "tower");
  }
  // Enemy core
  spawnStructure(matchArena.enemyCore.col, matchArena.enemyCore.row, 1, "core");

  console.log(
    `%c[Match] %cMatch started! Destroy the enemy core to win.`,
    "color: #ffb86c; font-weight: bold;",
    "color: #e0e0e8;"
  );
}

/**
 * Get the current match arena (for rendering + spawning player).
 */
export function getMatchArena(): MatchArena | null {
  return matchArena;
}

/**
 * End the match — clean up all match entities.
 */
export function endMatch() {
  // Remove all minions
  const minions = minionQuery(world);
  for (let i = 0; i < minions.length; i++) {
    removeEntity(world, minions[i]);
  }
  // Remove all structures
  const structures = structureQuery(world);
  for (let i = 0; i < structures.length; i++) {
    removeEntity(world, structures[i]);
  }
  // Remove match state
  const states = matchStateQuery(world);
  for (let i = 0; i < states.length; i++) {
    removeEntity(world, states[i]);
  }
  matchArena = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure Spawning
// ─────────────────────────────────────────────────────────────────────────────

function spawnStructure(col: number, row: number, teamId: number, type: "tower" | "core") {
  const def = STRUCTURE_TYPES[type];
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, Health, eid);
  addComponent(world, Hitbox, eid);
  addComponent(world, Team, eid);
  addComponent(world, Structure, eid);

  const w = tileToWorld(col, row);
  Position.x[eid] = w.x;
  Position.y[eid] = w.y;
  Sprite.spriteId[eid] = 8; // 8 = structure
  Sprite.zLayer[eid] = 2;
  Health.current[eid] = def.hp;
  Health.max[eid] = def.hp;
  Hitbox.radius[eid] = type === "core" ? 28 : 20;
  Team.id[eid] = teamId;
  Structure.teamId[eid] = teamId;
  Structure.hp[eid] = def.hp;
  Structure.maxHp[eid] = def.hp;
  Structure.damage[eid] = def.damage;
  Structure.attackRange[eid] = def.attackRange;
  Structure.attackCooldown[eid] = def.attackCooldown;
  Structure.attackTimer[eid] = 0;
  // Team-colored: blue for player, red for enemy
  const teamColor = teamId === 0 ? TEAM_COLORS.player : TEAM_COLORS.enemy;
  Structure.color[eid] = type === "core" ? teamColor.core : teamColor.structure;
  Structure.structureType[eid] = type === "core" ? 1 : 0;
  Structure.isCore[eid] = type === "core" ? 1 : 0;

  return eid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Minion Spawning
// ─────────────────────────────────────────────────────────────────────────────

function spawnMinion(
  col: number,
  row: number,
  teamId: number,
  lane: number,
  type: "melee" | "ranged"
) {
  const def = MINION_TYPES[type];
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, Health, eid);
  addComponent(world, Hitbox, eid);
  addComponent(world, Team, eid);
  addComponent(world, Minion, eid);

  const w = tileToWorld(col, row);
  Position.x[eid] = w.x;
  Position.y[eid] = w.y;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Sprite.spriteId[eid] = 9; // 9 = minion
  Sprite.zLayer[eid] = 2;
  Health.current[eid] = def.hp;
  Health.max[eid] = def.hp;
  Hitbox.radius[eid] = 10 * def.size;
  Team.id[eid] = teamId;
  Minion.teamId[eid] = teamId;
  Minion.hp[eid] = def.hp;
  Minion.maxHp[eid] = def.hp;
  Minion.damage[eid] = def.damage;
  Minion.speed[eid] = def.speed;
  Minion.attackRange[eid] = def.attackRange;
  Minion.attackCooldown[eid] = def.attackCooldown;
  Minion.attackTimer[eid] = 0;
  Minion.lane[eid] = lane;
  Minion.waypointIndex[eid] = 0;
  // Team-colored: blue for player minions, red for enemy minions
  Minion.color[eid] = teamId === 0 ? TEAM_COLORS.player.minion : TEAM_COLORS.enemy.minion;
  Minion.size[eid] = def.size;
  Minion.minionType[eid] = type === "ranged" ? 1 : 0;
}

/**
 * Spawn a wave of minions for both teams.
 */
function spawnWave() {
  if (!matchArena) return;

  const count = DEFAULT_MATCH_CONFIG.minionsPerLane;

  // Player minions (bottom-left, moving toward top-right)
  for (let i = 0; i < count; i++) {
    // Top lane
    spawnMinion(
      matchArena.playerStart.col + i,
      matchArena.playerStart.row - 2,
      0, // player team
      0, // top lane
      i === count - 1 ? "ranged" : "melee"
    );
    // Bottom lane
    spawnMinion(
      matchArena.playerStart.col + i,
      matchArena.playerStart.row,
      0,
      1, // bottom lane
      i === count - 1 ? "ranged" : "melee"
    );
  }

  // Enemy minions (top-right, moving toward bottom-left)
  for (let i = 0; i < count; i++) {
    // Top lane (enemy side)
    spawnMinion(
      matchArena.enemyCore.col - i,
      matchArena.enemyCore.row + 2,
      1, // enemy team
      0, // top lane
      i === count - 1 ? "ranged" : "melee"
    );
    // Bottom lane (enemy side)
    spawnMinion(
      matchArena.enemyCore.col - i,
      matchArena.enemyCore.row,
      1,
      1,
      i === count - 1 ? "ranged" : "melee"
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Match State System — timer + wave spawning + win/lose check
// ─────────────────────────────────────────────────────────────────────────────

export function matchStateSystem(dt: number) {
  const states = matchStateQuery(world);
  if (states.length === 0) return;
  const stateEid = states[0];

  // Already ended
  if (MatchState.result[stateEid] !== 0) return;

  // Update timers
  MatchState.matchTime[stateEid] += dt;
  MatchState.waveTimer[stateEid] -= dt;

  // Spawn waves
  if (MatchState.waveTimer[stateEid] <= 0) {
    MatchState.waveTimer[stateEid] = DEFAULT_MATCH_CONFIG.waveInterval;
    MatchState.waveCount[stateEid] += 1;
    spawnWave();
    console.log(
      `%c[Match] %cWave ${MatchState.waveCount[stateEid]} spawned!`,
      "color: #ffb86c; font-weight: bold;",
      "color: #e0e0e8;"
    );
  }

  // Check win/lose conditions
  const structures = structureQuery(world);
  let playerCoreAlive = false;
  let enemyCoreAlive = false;
  for (let i = 0; i < structures.length; i++) {
    const sid = structures[i];
    if (Structure.isCore[sid] === 1) {
      if (Structure.teamId[sid] === 0 && Health.current[sid] > 0) playerCoreAlive = true;
      if (Structure.teamId[sid] === 1 && Health.current[sid] > 0) enemyCoreAlive = true;
    }
  }

  if (!enemyCoreAlive) {
    MatchState.result[stateEid] = 1; // player won
    console.log("%c[Match] %cVICTORY! Enemy core destroyed.", "color: #40ff40; font-weight: bold;", "color: #e0e0e8;");
  } else if (!playerCoreAlive) {
    MatchState.result[stateEid] = 2; // enemy won
    console.log("%c[Match] %cDEFEAT! Your core was destroyed.", "color: #ff4040; font-weight: bold;", "color: #e0e0e8;");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Minion AI System — walk along lane, attack enemies in range
// ─────────────────────────────────────────────────────────────────────────────

export function minionAISystem(dt: number) {
  if (!matchArena) return;
  const minions = minionQuery(world);

  for (let i = 0; i < minions.length; i++) {
    const eid = minions[i];
    if (Health.current[eid] <= 0) continue;

    // Tick attack timer
    if (Minion.attackTimer[eid] > 0) {
      Minion.attackTimer[eid] = Math.max(0, Minion.attackTimer[eid] - dt);
    }

    // Find target: nearest enemy (minion, structure, or player)
    const target = findMinionTarget(eid);
    if (target >= 0) {
      const dx = Position.x[target] - Position.x[eid];
      const dy = Position.y[target] - Position.y[eid];
      const dist = Math.hypot(dx, dy);

      if (dist <= Minion.attackRange[eid]) {
        // In range — attack
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;
        if (Minion.attackTimer[eid] <= 0) {
          Minion.attackTimer[eid] = Minion.attackCooldown[eid];
          // Attack the target
          if (hasComponent(world, Health, target)) {
            Health.current[target] = Math.max(0, Health.current[target] - Minion.damage[eid]);
            spawnDamageNumber(Position.x[target], Position.y[target] - 10, Minion.damage[eid], false);
            if (Health.current[target] <= 0) {
              handleDeath(target);
            }
          }
        }
        continue;
      } else {
        // Move toward target
        Velocity.x[eid] = (dx / dist) * Minion.speed[eid];
        Velocity.y[eid] = (dy / dist) * Minion.speed[eid];
        continue;
      }
    }

    // No target — move along lane waypoints
    const lane = Minion.lane[eid];
    const waypoints = lane === 0 ? matchArena.topLane : matchArena.bottomLane;
    const wpIdx = Minion.waypointIndex[eid];

    if (wpIdx < waypoints.length) {
      const wp = waypoints[wpIdx];
      const wpWorld = tileToWorld(wp.col, wp.row);
      const dx = wpWorld.x - Position.x[eid];
      const dy = wpWorld.y - Position.y[eid];
      const dist = Math.hypot(dx, dy);

      if (dist < 20) {
        // Reached waypoint — move to next
        Minion.waypointIndex[eid] = wpIdx + 1;
        // Reverse direction for enemy team (they go the opposite way)
        if (Minion.teamId[eid] === 1 && Minion.waypointIndex[eid] >= waypoints.length) {
          Minion.waypointIndex[eid] = 0;
        }
      } else {
        Velocity.x[eid] = (dx / dist) * Minion.speed[eid];
        Velocity.y[eid] = (dy / dist) * Minion.speed[eid];
      }
    } else {
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
    }
  }
}

/**
 * Find the nearest enemy target for a minion.
 * Checks minions, structures, and the player.
 */
function findMinionTarget(minionEid: number): number {
  const myTeam = Minion.teamId[minionEid];
  const mx = Position.x[minionEid];
  const my = Position.y[minionEid];
  const aggroRange = 150;

  let bestDist = aggroRange;
  let bestTarget = -1;

  // Check other minions
  const minions = minionQuery(world);
  for (let i = 0; i < minions.length; i++) {
    const tid = minions[i];
    if (tid === minionEid) continue;
    if (Minion.teamId[tid] === myTeam) continue;
    if (Health.current[tid] <= 0) continue;
    const dx = Position.x[tid] - mx;
    const dy = Position.y[tid] - my;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = tid;
    }
  }

  // Check structures
  const structures = structureQuery(world);
  for (let i = 0; i < structures.length; i++) {
    const tid = structures[i];
    if (Structure.teamId[tid] === myTeam) continue;
    if (Health.current[tid] <= 0) continue;
    const dx = Position.x[tid] - mx;
    const dy = Position.y[tid] - my;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = tid;
    }
  }

  return bestTarget;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure AI System — towers + cores attack nearby enemies
// ─────────────────────────────────────────────────────────────────────────────

export function structureAISystem(dt: number) {
  const structures = structureQuery(world);

  for (let i = 0; i < structures.length; i++) {
    const eid = structures[i];
    if (Health.current[eid] <= 0) continue;

    // Tick attack timer
    if (Structure.attackTimer[eid] > 0) {
      Structure.attackTimer[eid] = Math.max(0, Structure.attackTimer[eid] - dt);
    }

    if (Structure.attackTimer[eid] > 0) continue;

    // Find nearest enemy minion in range
    const myTeam = Structure.teamId[eid];
    const sx = Position.x[eid];
    const sy = Position.y[eid];
    const range = Structure.attackRange[eid];

    const minions = minionQuery(world);
    let bestDist = range;
    let bestTarget = -1;

    for (let j = 0; j < minions.length; j++) {
      const tid = minions[j];
      if (Minion.teamId[tid] === myTeam) continue;
      if (Health.current[tid] <= 0) continue;
      const dx = Position.x[tid] - sx;
      const dy = Position.y[tid] - sy;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = tid;
      }
    }

    if (bestTarget >= 0) {
      Structure.attackTimer[eid] = Structure.attackCooldown[eid];
      Health.current[bestTarget] = Math.max(0, Health.current[bestTarget] - Structure.damage[eid]);
      spawnDamageNumber(Position.x[bestTarget], Position.y[bestTarget] - 10, Structure.damage[eid], false);
      if (Health.current[bestTarget] <= 0) {
        handleDeath(bestTarget);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup dead minions + structures
// ─────────────────────────────────────────────────────────────────────────────

export function cleanupMatchEntities() {
  const minions = minionQuery(world);
  for (let i = 0; i < minions.length; i++) {
    const eid = minions[i];
    if (Health.current[eid] <= 0) {
      removeEntity(world, eid);
    }
  }
  const structures = structureQuery(world);
  for (let i = 0; i < structures.length; i++) {
    const eid = structures[i];
    if (Health.current[eid] <= 0) {
      removeEntity(world, eid);
    }
  }
}
