/**
 * InputManager — keyboard + mouse input for the client.
 *
 * Reads raw browser events and translates them into ECS state writes:
 *  - WASD/arrows → Velocity on the player entity (overrides click-to-move)
 *  - Click on the map → MoveTarget on the player entity
 *
 * This module writes to ECS components, but it does NOT read from Pixi.
 * The camera-to-screen transform is provided by a callback so this stays
 * decoupled from the renderer.
 */

import { defineQuery, addComponent, hasComponent } from "bitecs";
import {
  world,
  Position,
  Velocity,
  PlayerTag,
  MoveTarget,
} from "@core/ecs/world";

const playerQuery = defineQuery([Position, Velocity, PlayerTag]);

const SPEED = 180; // px/sec — must match movementSystem's MOVEMENT_SPEED

export class InputManager {
  private keys: Set<string> = new Set();
  private screenToWorldFn: (sx: number, sy: number) => { x: number; y: number };

  constructor(
    screenToWorldFn: (sx: number, sy: number) => { x: number; y: number }
  ) {
    this.screenToWorldFn = screenToWorldFn;
    this.bind();
  }

  private bind() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    // Click handling is delegated to the canvas via the GameApp
  }

  /**
   * Called by GameApp when the canvas is clicked.
   */
  onCanvasClick(sx: number, sy: number) {
    const players = playerQuery(world);
    if (players.length === 0) return;
    const eid = players[0];

    const worldPoint = this.screenToWorldFn(sx, sy);
    if (!hasComponent(world, MoveTarget, eid)) {
      addComponent(world, MoveTarget, eid);
    }
    MoveTarget.x[eid] = worldPoint.x;
    MoveTarget.y[eid] = worldPoint.y;
    MoveTarget.active[eid] = 1;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      e.preventDefault();
    }
    this.keys.add(key);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onBlur = () => {
    this.keys.clear();
  };

  /**
   * Called every frame by GameApp.
   * If WASD/arrows are pressed, write Velocity directly and clear MoveTarget.
   * If not, leave Velocity at whatever movementSystem last set (or 0).
   */
  update() {
    const players = playerQuery(world);
    if (players.length === 0) return;
    const eid = players[0];

    let dx = 0;
    let dy = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;

    if (dx !== 0 || dy !== 0) {
      // Normalize so diagonal isn't faster
      const len = Math.hypot(dx, dy);
      Velocity.x[eid] = (dx / len) * SPEED;
      Velocity.y[eid] = (dy / len) * SPEED;
      // Cancel any active click-to-move target
      if (MoveTarget.active[eid] === 1) {
        MoveTarget.active[eid] = 0;
      }
    } else if (MoveTarget.active[eid] !== 1) {
      // No keys pressed AND no active click-to-move target → stop.
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
    }
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }
}
