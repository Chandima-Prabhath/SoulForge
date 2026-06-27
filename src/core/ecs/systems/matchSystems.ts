/**
 * Match Systems — MOBA-style minion AI, structure AI, win/lose.
 *
 * Phase 7.5: Complete rewrite with proper MOBA behavior.
 *
 * Structure AI (towers + cores):
 *   - Attack ANY enemy in range (player + minions)
 *   - Prioritize player if in range (like real MOBAs)
 *   - Otherwise attack nearest minion
 *
 * Minion AI:
 *   - Follow lane waypoints from spawn to enemy core
 *   - If enemy in aggro range, stop and attack
 *   - If enemy dies or leaves range, resume following waypoints
 *   - NEVER stand still doing nothing — always moving or attacking
 *   - Player minions go bottom→top, enemy minions go top→bottom
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
  PlayerTag,
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
const playerQuery = defineQuery([Position, PlayerTag, Health]);

// ─────────────────────────────────────────────────────────────────────────────
// Match Arena + State
// ─────────────────────────────────────────────────────────────────────────────

let matchArena: MatchArena | null = null;

export function startMatch() {
  matchArena = buildMatchArena();

  const stateEid = addEntity(world);
  addComponent(world, MatchState, stateEid);
  MatchState.matchTime[stateEid] = 0;
  MatchState.waveTimer[stateEid] = DEFAULT_MATCH_CONFIG.firstWaveDelay;
  MatchState.waveCount[stateEid] = 0;
  MatchState.result[stateEid] = 0;

  if (!matchArena) return;

  // Spawn structures
  for (const tower of matchArena.playerTowers) {
    spawnStructure(tower.col, tower.row, 0, "tower");
  }
  spawnStructure(matchArena.playerCore.col, matchArena.playerCore.row, 0, "core");

  for (const tower of matchArena.enemyTowers) {
    spawnStructure(tower.col, tower.row, 1, "tower");
  }
  spawnStructure(matchArena.enemyCore.col, matchArena.enemyCore.row, 1, "core");

  console.log(
    `%c[Match] %cMatch started! Destroy the enemy core to win.`,
    "color: #ffb86c; font-weight: bold;",
    "color: #e0e0e8;"
  );
}

export function getMatchArena(): MatchArena | null {
  return matchArena;
}

export function endMatch() {
  const minions = minionQuery(world);
  for (let i = 0; i < minions.length; i++) removeEntity(world, minions[i]);
  const structures = structureQuery(world);
  for (let i = 0; i < structures.length; i++) removeEntity(world, structures[i]);
  const states = matchStateQuery(world);
  for (let i = 0; i < states.length; i++) removeEntity(world, states[i]);
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
  Sprite.spriteId[eid] = 8;
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
  Sprite.spriteId[eid] = 9;
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
  // Player minions start at waypoint 0 (going forward)
  // Enemy minions start at the LAST waypoint (going backward)
  // We'll set this after determining the lane in spawnWave, but for now
  // set to 0 — the minionAISystem will handle direction based on teamId
  Minion.waypointIndex[eid] = teamId === 0 ? 0 : 99; // 99 = "start from end"
  Minion.color[eid] = teamId === 0 ? TEAM_COLORS.player.minion : TEAM_COLORS.enemy.minion;
  Minion.size[eid] = def.size;
  Minion.minionType[eid] = type === "ranged" ? 1 : 0;
}

function spawnWave() {
  if (!matchArena) return;
  const count = DEFAULT_MATCH_CONFIG.minionsPerLane;

  // Player minions spawn at player core, go toward enemy core (3 lanes: 0=top, 1=mid, 2=bottom)
  for (let lane = 0; lane < 3; lane++) {
    for (let i = 0; i < count; i++) {
      spawnMinion(matchArena.playerCore.col + i - 1, matchArena.playerCore.row - 2, 0, lane, i === count - 1 ? "ranged" : "melee");
    }
  }

  // Enemy minions spawn at enemy core, go toward player core
  for (let lane = 0; lane < 3; lane++) {
    for (let i = 0; i < count; i++) {
      spawnMinion(matchArena.enemyCore.col + i - 1, matchArena.enemyCore.row + 2, 1, lane, i === count - 1 ? "ranged" : "melee");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Match State System — timer + wave spawning + win/lose
// ─────────────────────────────────────────────────────────────────────────────

export function matchStateSystem(dt: number) {
  const states = matchStateQuery(world);
  if (states.length === 0) return;
  const stateEid = states[0];
  if (MatchState.result[stateEid] !== 0) return;

  MatchState.matchTime[stateEid] += dt;
  MatchState.waveTimer[stateEid] -= dt;

  if (MatchState.waveTimer[stateEid] <= 0) {
    MatchState.waveTimer[stateEid] = DEFAULT_MATCH_CONFIG.waveInterval;
    MatchState.waveCount[stateEid] += 1;
    spawnWave();
    console.log(`%c[Match] %cWave ${MatchState.waveCount[stateEid]} spawned!`, "color: #ffb86c; font-weight: bold;", "color: #e0e0e8;");
  }

  // Check win/lose
  const structures = structureQuery(world);
  let playerCoreAlive = false;
  let enemyCoreAlive = false;
  for (let i = 0; i < structures.length; i++) {
    const sid = structures[i];
    if (Structure.isCore[sid] === 1 && Health.current[sid] > 0) {
      if (Structure.teamId[sid] === 0) playerCoreAlive = true;
      if (Structure.teamId[sid] === 1) enemyCoreAlive = true;
    }
  }

  if (!enemyCoreAlive) {
    MatchState.result[stateEid] = 1;
    console.log("%c[Match] %cVICTORY! Enemy core destroyed.", "color: #40ff40; font-weight: bold;", "color: #e0e0e8;");
  } else if (!playerCoreAlive) {
    MatchState.result[stateEid] = 2;
    console.log("%c[Match] %cDEFEAT! Your core was destroyed.", "color: #ff4040; font-weight: bold;", "color: #e0e0e8;");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Minion AI System — MOBA-style
//
// Each minion:
//   1. If enemy in aggro range → move toward + attack
//   2. If no enemy in range → follow lane waypoints toward enemy core
//   3. NEVER stand still — always moving or attacking
//
// Player minions: follow waypoints 0→1→2→3→4 (bottom to top)
// Enemy minions: follow waypoints 4→3→2→1→0 (top to bottom)
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

    const myTeam = Minion.teamId[eid];
    const mx = Position.x[eid];
    const my = Position.y[eid];
    const aggroRange = 120; // aggro range for finding targets

    // ── Step 1: Find nearest enemy target ────────────────────────────
    let target = -1;
    let bestDist = aggroRange;

    // Check enemy minions
    for (let j = 0; j < minions.length; j++) {
      const tid = minions[j];
      if (tid === eid) continue;
      if (Minion.teamId[tid] === myTeam) continue;
      if (Health.current[tid] <= 0) continue;
      const dx = Position.x[tid] - mx;
      const dy = Position.y[tid] - my;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        target = tid;
      }
    }

    // Check enemy structures
    const structures = structureQuery(world);
    for (let j = 0; j < structures.length; j++) {
      const tid = structures[j];
      if (Structure.teamId[tid] === myTeam) continue;
      if (Health.current[tid] <= 0) continue;
      const dx = Position.x[tid] - mx;
      const dy = Position.y[tid] - my;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        target = tid;
      }
    }

    // Check enemy player (structures/minions can attack player too)
    const players = playerQuery(world);
    for (let j = 0; j < players.length; j++) {
      const tid = players[j];
      if (Health.current[tid] <= 0) continue;
      // Only attack player if on opposite team
      if (hasComponent(world, Team, tid) && Team.id[tid] === myTeam) continue;
      const dx = Position.x[tid] - mx;
      const dy = Position.y[tid] - my;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        target = tid;
      }
    }

    // ── Step 2: If target found, attack or move toward it ────────────
    if (target >= 0) {
      const dx = Position.x[target] - mx;
      const dy = Position.y[target] - my;
      const dist = Math.hypot(dx, dy);

      if (dist <= Minion.attackRange[eid]) {
        // In range — stop and attack
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;
        if (Minion.attackTimer[eid] <= 0) {
          Minion.attackTimer[eid] = Minion.attackCooldown[eid];
          if (hasComponent(world, Health, target)) {
            Health.current[target] = Math.max(0, Health.current[target] - Minion.damage[eid]);
            spawnDamageNumber(Position.x[target], Position.y[target] - 10, Minion.damage[eid], false);
            if (Health.current[target] <= 0) {
              handleDeath(target);
            }
          }
        }
      } else {
        // Out of range — move toward target
        Velocity.x[eid] = (dx / dist) * Minion.speed[eid];
        Velocity.y[eid] = (dy / dist) * Minion.speed[eid];
      }
      continue; // Skip waypoint following — we have a target
    }

    // ── Step 3: No target — follow lane waypoints ────────────────────
    const lane = Minion.lane[eid];
    // Lane 0 = top, 1 = mid, 2 = bottom
    const waypoints = lane === 0 ? matchArena.topLane : (lane === 1 ? matchArena.midLane : matchArena.bottomLane);
    let wpIdx = Minion.waypointIndex[eid];

    // Fix: if enemy minion has wpIdx=99, set to last waypoint
    if (wpIdx >= waypoints.length) {
      wpIdx = waypoints.length - 1;
      Minion.waypointIndex[eid] = wpIdx;
    }

    // Player minions go 0→last, enemy minions go last→0
    if (myTeam === 0) {
      // Player minion — advance forward
      if (wpIdx >= waypoints.length) wpIdx = waypoints.length - 1;
    } else {
      // Enemy minion — advance backward
      if (wpIdx < 0) wpIdx = 0;
    }

    const wp = waypoints[wpIdx];
    const wpWorld = tileToWorld(wp.col, wp.row);
    const dx = wpWorld.x - mx;
    const dy = wpWorld.y - my;
    const dist = Math.hypot(dx, dy);

    if (dist < 30) {
      // Reached waypoint — advance to next
      if (myTeam === 0) {
        Minion.waypointIndex[eid] = Math.min(wpIdx + 1, waypoints.length - 1);
      } else {
        Minion.waypointIndex[eid] = Math.max(wpIdx - 1, 0);
      }
      // If at the last waypoint, attack the enemy core
      // (handled by target-finding above since core is a structure)
    }

    // Move toward current waypoint
    if (dist > 5) {
      Velocity.x[eid] = (dx / dist) * Minion.speed[eid];
      Velocity.y[eid] = (dy / dist) * Minion.speed[eid];
    } else {
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure AI System — MOBA-style
//
// Towers + cores attack ANY enemy in range:
//   1. Prioritize the PLAYER if in range (highest threat)
//   2. Otherwise attack nearest enemy minion
//   3. If nothing in range, do nothing (wait)
// ─────────────────────────────────────────────────────────────────────────────

export function structureAISystem(dt: number) {
  const structures = structureQuery(world);

  for (let i = 0; i < structures.length; i++) {
    const eid = structures[i];
    if (Health.current[eid] <= 0) continue;

    if (Structure.attackTimer[eid] > 0) {
      Structure.attackTimer[eid] = Math.max(0, Structure.attackTimer[eid] - dt);
    }
    if (Structure.attackTimer[eid] > 0) continue;

    const myTeam = Structure.teamId[eid];
    const sx = Position.x[eid];
    const sy = Position.y[eid];
    const range = Structure.attackRange[eid];

    // ── Priority 1: Attack the player if in range ────────────────────
    const players = playerQuery(world);
    let playerTarget = -1;
    for (let j = 0; j < players.length; j++) {
      const pid = players[j];
      if (Health.current[pid] <= 0) continue;
      // Check if player is on the enemy team
      if (hasComponent(world, Team, pid) && Team.id[pid] === myTeam) continue;
      const dx = Position.x[pid] - sx;
      const dy = Position.y[pid] - sy;
      const dist = Math.hypot(dx, dy);
      if (dist < range) {
        playerTarget = pid;
        break;
      }
    }

    if (playerTarget >= 0) {
      Structure.attackTimer[eid] = Structure.attackCooldown[eid];
      Health.current[playerTarget] = Math.max(0, Health.current[playerTarget] - Structure.damage[eid]);
      spawnDamageNumber(Position.x[playerTarget], Position.y[playerTarget] - 10, Structure.damage[eid], false);
      if (Health.current[playerTarget] <= 0) {
        handleDeath(playerTarget);
      }
      continue; // Player takes priority
    }

    // ── Priority 2: Attack nearest enemy minion ──────────────────────
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
    if (Health.current[minions[i]] <= 0) removeEntity(world, minions[i]);
  }
  const structures = structureQuery(world);
  for (let i = 0; i < structures.length; i++) {
    if (Health.current[structures[i]] <= 0) removeEntity(world, structures[i]);
  }
}
