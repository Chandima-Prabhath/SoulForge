/**
 * Combat Systems — pure simulation, no rendering.
 *
 * Phase 1 systems for combat:
 *   - cooldownSystem: decrements all cooldowns
 *   - facingSystem: updates Facing from Velocity
 *   - attackSystem: handles player input → spawns Mana Bolt projectiles
 *   - projectileSystem: moves projectiles, lifetime decay
 *   - collisionSystem: projectile ↔ hitbox collision, applies damage
 *   - combatSystem: applies damage, handles death, drops essence, spawns damage numbers
 *   - enemyAISystem: idle → chase → attack state machine
 *   - lifetimeSystem: despawns entities when Lifetime hits 0
 *   - damageNumberSystem: ages damage numbers and despawns them
 *
 * All systems are pure functions of (dt) and operate on the shared world.
 * The GameApp calls them in order each frame.
 */

import {
  addEntity,
  addComponent,
  defineQuery,
  hasComponent,
  removeEntity,
  removeComponent,
} from "bitecs";
import {
  world,
  Position,
  Velocity,
  Sprite,
  PlayerTag,
  CameraTargetTag,
  MoveTarget,
  Health,
  Hitbox,
  Team,
  Projectile,
  Lifetime,
  Facing,
  Cooldown,
  EnemyAI,
  DamageNumber,
  EssenceShard,
} from "../world";

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

const cooldownQuery = defineQuery([Cooldown]);
const facingQuery = defineQuery([Velocity, Facing]);
const playerQuery = defineQuery([PlayerTag, Position, Facing, Cooldown, Health]);
const projectileQuery = defineQuery([Position, Velocity, Projectile, Lifetime]);
const damageableQuery = defineQuery([Position, Hitbox, Health, Team]);
const enemyQuery = defineQuery([Position, Velocity, EnemyAI, Health, Team]);
const lifetimeQuery = defineQuery([Lifetime]);
const damageNumberQuery = defineQuery([DamageNumber, Position]);

// ─────────────────────────────────────────────────────────────────────────────
// Cooldown System
// ─────────────────────────────────────────────────────────────────────────────

export function cooldownSystem(dt: number) {
  const entities = cooldownQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (Cooldown.current[eid] > 0) {
      Cooldown.current[eid] = Math.max(0, Cooldown.current[eid] - dt);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Facing System — point Facing in the direction of Velocity
// ─────────────────────────────────────────────────────────────────────────────

export function facingSystem(_dt: number) {
  const entities = facingQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const vx = Velocity.x[eid];
    const vy = Velocity.y[eid];
    const speed = Math.hypot(vx, vy);
    if (speed > 1) {
      Facing.x[eid] = vx / speed;
      Facing.y[eid] = vy / speed;
    }
    // If not moving, keep last facing (don't reset).
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attack System — player casts Mana Bolt toward a target point.
//
// GameApp passes in a "cast request" each frame: { active, x, y }.
// If active and cooldown is ready, spawn a projectile and start cooldown.
// ─────────────────────────────────────────────────────────────────────────────

export interface CastRequest {
  active: boolean;
  x: number;
  y: number;
}

const MANA_BOLT_SPEED = 420; // px/sec
const MANA_BOLT_DAMAGE = 25;
const MANA_BOLT_LIFETIME = 1.6; // seconds
const MANA_BOLT_COOLDOWN = 0.45; // seconds
const MANA_BOLT_RADIUS = 8; // hitbox radius

export function attackSystem(_dt: number, cast: CastRequest) {
  if (!cast.active) return;
  const players = playerQuery(world);
  if (players.length === 0) return;
  const pid = players[0];

  if (Cooldown.current[pid] > 0) return;

  // Aim from player position toward cast point
  const dx = cast.x - Position.x[pid];
  const dy = cast.y - Position.y[pid];
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return; // can't aim at self

  const nx = dx / dist;
  const ny = dy / dist;

  // Update player facing to match cast direction
  Facing.x[pid] = nx;
  Facing.y[pid] = ny;

  // Spawn the projectile
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, Projectile, eid);
  addComponent(world, Lifetime, eid);
  addComponent(world, Hitbox, eid);
  addComponent(world, Team, eid);

  // Spawn slightly ahead of the player so it doesn't collide with the caster
  Position.x[eid] = Position.x[pid] + nx * 16;
  Position.y[eid] = Position.y[pid] + ny * 16;
  Velocity.x[eid] = nx * MANA_BOLT_SPEED;
  Velocity.y[eid] = ny * MANA_BOLT_SPEED;
  Sprite.spriteId[eid] = 1; // 1 = mana bolt projectile
  Sprite.zLayer[eid] = 3; // vfx layer
  Projectile.damage[eid] = MANA_BOLT_DAMAGE;
  Projectile.teamId[eid] = 0; // player team
  Projectile.pierceCount[eid] = 0; // no pierce for now
  Lifetime.remaining[eid] = MANA_BOLT_LIFETIME;
  Hitbox.radius[eid] = MANA_BOLT_RADIUS;
  Team.id[eid] = 0;

  // Start the player's cooldown
  Cooldown.current[pid] = Cooldown.max[pid];

  // Stop the player's movement when casting (briefly)
  // — design choice: casting cancels click-to-move so you can kite
  if (hasComponent(world, MoveTarget, pid)) {
    MoveTarget.active[pid] = 0;
  }
  Velocity.x[pid] = 0;
  Velocity.y[pid] = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projectile System — move projectiles, decay lifetime, despawn on expiry
// ─────────────────────────────────────────────────────────────────────────────

export function projectileSystem(dt: number) {
  const entities = projectileQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;
    Lifetime.remaining[eid] -= dt;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Collision System — projectiles hit damageable entities on opposite team
//
// On hit: apply damage, spawn damage number, decrement pierce or despawn projectile.
// ─────────────────────────────────────────────────────────────────────────────

export function collisionSystem() {
  const projectiles = projectileQuery(world);
  const targets = damageableQuery(world);

  for (let i = 0; i < projectiles.length; i++) {
    const pid = projectiles[i];
    const pTeam = Projectile.teamId[pid];
    const px = Position.x[pid];
    const py = Position.y[pid];
    const pr = Hitbox.radius[pid];

    for (let j = 0; j < targets.length; j++) {
      const tid = targets[j];
      // Skip same-team
      if (Team.id[tid] === pTeam) continue;
      // Skip dead targets
      if (Health.current[tid] <= 0) continue;

      const dx = Position.x[tid] - px;
      const dy = Position.y[tid] - py;
      const dist = Math.hypot(dx, dy);
      const combinedR = pr + Hitbox.radius[tid];

      if (dist < combinedR) {
        // HIT — apply damage
        const dmg = Projectile.damage[pid];
        Health.current[tid] = Math.max(0, Health.current[tid] - dmg);

        // Spawn damage number at the hit location
        spawnDamageNumber(px, py - 10, dmg, /*crit*/ false);

        // If target died, mark for cleanup
        if (Health.current[tid] <= 0) {
          handleDeath(tid);
        }

        // Decrement pierce or despawn projectile
        if (Projectile.pierceCount[pid] > 0) {
          Projectile.pierceCount[pid] -= 1;
        } else {
          removeEntity(world, pid);
          break; // projectile gone, move to next
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat System — handles death cleanup and essence drops
// ─────────────────────────────────────────────────────────────────────────────

function handleDeath(eid: number) {
  // Drop an essence shard at the death location
  if (hasComponent(world, Position, eid)) {
    spawnEssenceShard(Position.x[eid], Position.y[eid], 1);
  }

  // If it's an enemy, mark AI as dead so the AI system can clean it up
  if (hasComponent(world, EnemyAI, eid)) {
    EnemyAI.state[eid] = 3; // dead
  }

  // The actual entity removal happens in cleanupDeadEntities()
}

export function cleanupDeadEntities() {
  const enemies = enemyQuery(world);
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i];
    if (EnemyAI.state[eid] === 3 || Health.current[eid] <= 0) {
      // Spawn a death poof (just a damage number with a special value)
      spawnDamageNumber(Position.x[eid], Position.y[eid] - 20, 0, false);
      removeEntity(world, eid);
    }
  }

  // Also clean up the player if they're dead (HP <= 0)
  // — player respawn is handled by GameApp on R key, which clears all entities.
  const players = playerQuery(world);
  for (let i = 0; i < players.length; i++) {
    const pid = players[i];
    if (Health.current[pid] <= 0) {
      // Drop a final essence shard where they fell
      if (!hasComponent(world, EssenceShard, pid)) {
        // Just remove — GameApp will show "DEAD" and respawn on R press
        removeEntity(world, pid);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Damage Number spawning
// ─────────────────────────────────────────────────────────────────────────────

function spawnDamageNumber(
  x: number,
  y: number,
  value: number,
  crit: boolean
) {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, DamageNumber, eid);
  addComponent(world, Lifetime, eid);

  Position.x[eid] = x + (Math.random() - 0.5) * 12;
  Position.y[eid] = y;
  Velocity.x[eid] = (Math.random() - 0.5) * 20;
  Velocity.y[eid] = -60; // float upward
  Sprite.spriteId[eid] = 2; // 2 = damage number
  Sprite.zLayer[eid] = 4; // above everything
  DamageNumber.value[eid] = value;
  DamageNumber.age[eid] = 0;
  DamageNumber.ttl[eid] = 0.9;
  Lifetime.remaining[eid] = 0.9;
  // Note: crit flag is unused in Phase 1 but wired in for Phase 2
  void crit;
}

// ─────────────────────────────────────────────────────────────────────────────
// Damage Number System — ages them, floats them, despawns via Lifetime
// ─────────────────────────────────────────────────────────────────────────────

export function damageNumberSystem(dt: number) {
  const entities = damageNumberQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    DamageNumber.age[eid] += dt;
    // Apply velocity (floats up + slight drift)
    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;
    // Decelerate
    Velocity.x[eid] *= 0.92;
    Velocity.y[eid] *= 0.88;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Essence Shard spawning — placeholder for Phase 3 (Devour)
// ─────────────────────────────────────────────────────────────────────────────

function spawnEssenceShard(x: number, y: number, value: number) {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, EssenceShard, eid);
  addComponent(world, Lifetime, eid);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Sprite.spriteId[eid] = 3; // 3 = essence shard
  Sprite.zLayer[eid] = 1;
  EssenceShard.value[eid] = value;
  Lifetime.remaining[eid] = 8; // disappears after 8s if not devoured
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifetime System — despawns any entity whose Lifetime hit 0
// ─────────────────────────────────────────────────────────────────────────────

export function lifetimeSystem() {
  const entities = lifetimeQuery(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    if (Lifetime.remaining[eid] <= 0) {
      removeEntity(world, eid);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enemy AI System — idle / chase / attack state machine
//
// States:
//   0 = idle   — wander slowly; if player in aggroRange, → chase
//   1 = chase  — move toward player; if in attackRange, → attack
//   2 = attack — stand still, attack on cooldown; if player leaves range, → chase
//   3 = dead   — handled by cleanupDeadEntities
// ─────────────────────────────────────────────────────────────────────────────

const ENEMY_SPEED = 90; // px/sec — slower than player (180) so you can kite

export function enemyAISystem(dt: number) {
  const players = playerQuery(world);
  if (players.length === 0) return;
  const pid = players[0];
  const px = Position.x[pid];
  const py = Position.y[pid];

  const enemies = enemyQuery(world);
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i];
    if (EnemyAI.state[eid] === 3) continue;

    const ex = Position.x[eid];
    const ey = Position.y[eid];
    const dx = px - ex;
    const dy = py - ey;
    const dist = Math.hypot(dx, dy);

    // Tick attack timer
    if (EnemyAI.attackTimer[eid] > 0) {
      EnemyAI.attackTimer[eid] = Math.max(0, EnemyAI.attackTimer[eid] - dt);
    }

    // Tick wander timer
    EnemyAI.wanderTimer[eid] -= dt;

    switch (EnemyAI.state[eid]) {
      case 0: // idle
        // Wander
        if (EnemyAI.wanderTimer[eid] <= 0) {
          EnemyAI.wanderTimer[eid] = 1.5 + Math.random() * 2;
          if (Math.random() < 0.5) {
            // pick a new wander direction
            const angle = Math.random() * Math.PI * 2;
            EnemyAI.wanderDx[eid] = Math.cos(angle) * 0.4;
            EnemyAI.wanderDy[eid] = Math.sin(angle) * 0.4;
          } else {
            // stand still
            EnemyAI.wanderDx[eid] = 0;
            EnemyAI.wanderDy[eid] = 0;
          }
        }
        Velocity.x[eid] = EnemyAI.wanderDx[eid] * ENEMY_SPEED * 0.5;
        Velocity.y[eid] = EnemyAI.wanderDy[eid] * ENEMY_SPEED * 0.5;

        // Aggro check
        if (dist < EnemyAI.aggroRange[eid]) {
          EnemyAI.state[eid] = 1;
        }
        break;

      case 1: // chase
        if (dist < 1) break;
        Velocity.x[eid] = (dx / dist) * ENEMY_SPEED;
        Velocity.y[eid] = (dy / dist) * ENEMY_SPEED;
        if (dist < EnemyAI.attackRange[eid]) {
          EnemyAI.state[eid] = 2;
        } else if (dist > EnemyAI.aggroRange[eid] * 1.5) {
          // Leash — give up chase
          EnemyAI.state[eid] = 0;
          Velocity.x[eid] = 0;
          Velocity.y[eid] = 0;
        }
        break;

      case 2: // attack
        // Stop moving while attacking
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;

        if (dist > EnemyAI.attackRange[eid] * 1.2) {
          // Player ran away
          EnemyAI.state[eid] = 1;
          break;
        }

        // Attack on cooldown
        if (EnemyAI.attackTimer[eid] <= 0) {
          EnemyAI.attackTimer[eid] = EnemyAI.attackCooldown[eid];
          // Apply melee damage to the player
          if (hasComponent(world, Health, pid)) {
            const dmg = 8;
            Health.current[pid] = Math.max(0, Health.current[pid] - dmg);
            spawnDamageNumber(Position.x[pid], Position.y[pid] - 20, dmg, false);
            if (Health.current[pid] <= 0) {
              handleDeath(pid);
            }
          }
        }
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Spawners
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawn an enemy at a world position. Phase 1 enemy: "Slime" — simple chaser.
 */
export function spawnEnemy(x: number, y: number): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, Health, eid);
  addComponent(world, Hitbox, eid);
  addComponent(world, Team, eid);
  addComponent(world, Facing, eid);
  addComponent(world, EnemyAI, eid);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Sprite.spriteId[eid] = 4; // 4 = enemy slime
  Sprite.zLayer[eid] = 2;
  Health.current[eid] = 50;
  Health.max[eid] = 50;
  Hitbox.radius[eid] = 16;
  Team.id[eid] = 1;
  Facing.x[eid] = 0;
  Facing.y[eid] = 1;
  EnemyAI.state[eid] = 0;
  EnemyAI.aggroRange[eid] = 200; // tighter aggro so player can approach safely
  EnemyAI.attackRange[eid] = 36;
  EnemyAI.attackCooldown[eid] = 1.5;
  EnemyAI.attackTimer[eid] = 0;
  EnemyAI.wanderTimer[eid] = 0;
  EnemyAI.wanderDx[eid] = 0;
  EnemyAI.wanderDy[eid] = 0;
  return eid;
}

/**
 * Helper: spawn the player entity with full combat stats.
 * (Updated from Phase 0's spawnPlayer to include Health, Hitbox, Team, Facing, Cooldown.)
 */
export function spawnPlayerFull(x: number, y: number): number {
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
  Cooldown.max[eid] = MANA_BOLT_COOLDOWN;
  return eid;
}

/**
 * Reset everything — used by the death/respawn flow.
 */
export function clearAllEntities() {
  const all = defineQuery([Position])(world);
  for (let i = 0; i < all.length; i++) {
    removeEntity(world, all[i]);
  }
}

// Re-export for callers that need it
export { removeComponent };
