/**
 * InputManager — keyboard + mouse input for the client.
 *
 * Phase 2 controls:
 *   WASD / Arrows — movement
 *   Left-click    — walk-to-point
 *   Right-click   — cast slot 0 (basic attack = Mana Bolt) toward point
 *   1, 2, 3, 4    — cast skill slots 0..3 toward mouse position
 *   R             — respawn (after death)
 *
 * The cast request is read by GameApp each frame and passed to castSkillSystem.
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

/**
 * A skill cast request. GameApp reads these each frame and feeds them to
 * castSkillSystem. Only ONE cast can happen per frame (the highest-priority
 * pending one); the rest are discarded.
 */
export interface SkillCastRequest {
  /** 0..3 — which skill slot to cast. */
  slot: number;
  /** World-space target point. */
  targetX: number;
  targetY: number;
  /** Whether the cast is actually requested this frame. */
  active: boolean;
}

export class InputManager {
  private keys: Set<string> = new Set();
  private screenToWorldFn: (sx: number, sy: number) => { x: number; y: number };

  // Pending cast requests — one per slot, GameApp consumes them each frame.
  // Slot 0 (right-click) is set via onCanvasRightClick.
  // Slots 1..3 are set via number keys 1..4.
  private pendingCasts: SkillCastRequest[] = [
    { slot: 0, targetX: 0, targetY: 0, active: false },
    { slot: 1, targetX: 0, targetY: 0, active: false },
    { slot: 2, targetX: 0, targetY: 0, active: false },
    { slot: 3, targetX: 0, targetY: 0, active: false },
  ];

  // Last known mouse position in screen space — used to aim skill casts
  private mouseX = 0;
  private mouseY = 0;

  // Phase 3: Devour skill activation (E key, edge-triggered)
  private devourRequested = false;

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
    window.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("mousemove", this.onMouseMove);
    // Click handling is delegated to the canvas via the GameApp
  }

  /**
   * Called by GameApp when the canvas is left-clicked.
   */
  onCanvasLeftClick(sx: number, sy: number) {
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

  /**
   * Called by GameApp when the canvas is right-clicked.
   * Sets a pending cast for slot 0 (basic attack) toward the click point.
   */
  onCanvasRightClick(sx: number, sy: number) {
    const worldPoint = this.screenToWorldFn(sx, sy);
    this.pendingCasts[0] = {
      slot: 0,
      targetX: worldPoint.x,
      targetY: worldPoint.y,
      active: true,
    };
  }

  /**
   * Consume all pending cast requests. GameApp calls this once per frame
   * after feeding them to castSkillSystem.
   *
   * Returns the array (mutated in place — caller should clear active flags).
   */
  consumeCastRequests(): SkillCastRequest[] {
    return this.pendingCasts;
  }

  /**
   * Clear all pending casts. Called by GameApp after processing.
   */
  clearCastRequests() {
    for (let i = 0; i < this.pendingCasts.length; i++) {
      this.pendingCasts[i].active = false;
    }
  }

  /**
   * Consume the pending Devour request (E key). Returns true if Devour was
   * requested this frame, then clears the flag.
   */
  consumeDevourRequest(): boolean {
    const req = this.devourRequested;
    this.devourRequested = false;
    return req;
  }

  private onMouseMove = (e: MouseEvent) => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  };

  private onContextMenu = (e: MouseEvent) => {
    // Prevent the browser's right-click menu from showing over the canvas
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      e.preventDefault();
    }
    this.keys.add(key);

    // Number keys 1-4 → cast skill slots 0-3 toward mouse position
    if (["1", "2", "3", "4"].includes(key)) {
      const slot = parseInt(key, 10) - 1;
      if (slot >= 0 && slot <= 3) {
        const canvas = document.getElementById("soulforge-canvas");
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const sx = this.mouseX - rect.left;
          const sy = this.mouseY - rect.top;
          const worldPoint = this.screenToWorldFn(sx, sy);
          this.pendingCasts[slot] = {
            slot,
            targetX: worldPoint.x,
            targetY: worldPoint.y,
            active: true,
          };
        }
      }
    }

    // E key → activate Devour skill (Phase 3)
    if (key === "e") {
      this.devourRequested = true;
    }
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

  /**
   * Check if R is currently pressed (used for respawn).
   */
  isRPressed(): boolean {
    return this.keys.has("r");
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("mousemove", this.onMouseMove);
  }
}
