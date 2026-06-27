/**
 * Movement System — pure simulation, no rendering.
 *
 * Reads: Velocity, MoveTarget, Position
 * Writes: Position, Velocity
 *
 * Two modes:
 *  1. Direct velocity (WASD) — Velocity is set by the input system.
 *  2. Click-to-move — Velocity is computed here to steer toward MoveTarget.
 *
 * When WASD input is active, it overrides click-to-move (MoveTarget is cleared).
 */

import {
  addEntity,
  addComponent,
  defineQuery,
  hasComponent,
  removeEntity,
} from "bitecs";
import {
  world,
  Position,
  Velocity,
  MoveTarget,
  PlayerTag,
  CameraTargetTag,
  Sprite,
} from "../world";

const MOVEMENT_SPEED = 180; // pixels per second
const ARRIVAL_THRESHOLD = 6; // pixels — stop when this close to target

const movers = defineQuery([Position, Velocity]);

export function movementSystem(dt: number) {
  const entities = movers(world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];

    // If the entity has an active MoveTarget, steer toward it.
    if (hasComponent(world, MoveTarget, eid) && MoveTarget.active[eid] === 1) {
      const dx = MoveTarget.x[eid] - Position.x[eid];
      const dy = MoveTarget.y[eid] - Position.y[eid];
      const dist = Math.hypot(dx, dy);

      if (dist < ARRIVAL_THRESHOLD) {
        // Arrived.
        Velocity.x[eid] = 0;
        Velocity.y[eid] = 0;
        MoveTarget.active[eid] = 0;
      } else {
        Velocity.x[eid] = (dx / dist) * MOVEMENT_SPEED;
        Velocity.y[eid] = (dy / dist) * MOVEMENT_SPEED;
      }
    }

    // Apply velocity to position.
    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;
  }
}

/**
 * Helper: spawn the player entity at a given world position.
 * Returns the entity ID.
 */
export function spawnPlayer(x: number, y: number): number {
  const eid = addEntity(world);
  addComponent(world, Position, eid);
  addComponent(world, Velocity, eid);
  addComponent(world, Sprite, eid);
  addComponent(world, PlayerTag, eid);
  addComponent(world, CameraTargetTag, eid);
  addComponent(world, MoveTarget, eid);

  Position.x[eid] = x;
  Position.y[eid] = y;
  Velocity.x[eid] = 0;
  Velocity.y[eid] = 0;
  Sprite.spriteId[eid] = 0; // 0 = player sprite
  Sprite.zLayer[eid] = 2;
  MoveTarget.active[eid] = 0;
  return eid;
}

/**
 * Remove all entities — used for resets between phases.
 */
export function clearAllEntities() {
  const entities = movers(world);
  for (let i = 0; i < entities.length; i++) {
    removeEntity(world, entities[i]);
  }
}
