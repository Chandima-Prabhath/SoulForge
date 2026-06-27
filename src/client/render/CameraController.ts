/**
 * CameraController — smooth-follow camera for PixiJS.
 *
 * Reads the entity with CameraTargetTag and centers the world container on it.
 * Uses exponential smoothing (lerp) — frame-rate independent.
 *
 * This is CLIENT-only. Game Core doesn't know there's a camera.
 */

import { Container } from "pixi.js";
import { defineQuery } from "bitecs";
import { world, Position, CameraTargetTag } from "@core/ecs/world";

const targetQuery = defineQuery([Position, CameraTargetTag]);

const SMOOTH = 8.0; // higher = snappier; 1.0 = very loose

export class CameraController {
  private worldContainer: Container;
  private screenWidth: number;
  private screenHeight: number;

  // Current camera position (top-left of viewport in world space)
  private camX: number;
  private camY: number;

  constructor(worldContainer: Container, screenWidth: number, screenHeight: number) {
    this.worldContainer = worldContainer;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.camX = 0;
    this.camY = 0;
  }

  resize(w: number, h: number) {
    this.screenWidth = w;
    this.screenHeight = h;
  }

  update(dt: number) {
    const targets = targetQuery(world);
    if (targets.length === 0) return;
    const eid = targets[0];

    // Account for zoom: the world is scaled, so screen-to-world mapping changes.
    // We need to center the player on screen by adjusting for the scale.
    const scale = this.worldContainer.scale.x;
    const halfScreenW = this.screenWidth / 2 / scale;
    const halfScreenH = this.screenHeight / 2 / scale;

    // Where we want the camera's top-left to be so the target is centered
    const desiredX = Position.x[eid] - halfScreenW;
    const desiredY = Position.y[eid] - halfScreenH;

    // Exponential smoothing: frame-rate independent lerp
    const t = 1 - Math.exp(-SMOOTH * dt);
    this.camX += (desiredX - this.camX) * t;
    this.camY += (desiredY - this.camY) * t;

    // Apply position + scale
    this.worldContainer.position.set(-this.camX * scale, -this.camY * scale);
  }

  /**
   * Convert a screen-space pixel point (e.g., a click) to world space.
   * Needed for click-to-move input handling.
   * Must account for the worldContainer's scale (zoom).
   */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const scale = this.worldContainer.scale.x;
    return { x: sx / scale + this.camX, y: sy / scale + this.camY };
  }

  get position(): { x: number; y: number } {
    return { x: this.camX, y: this.camY };
  }
}
