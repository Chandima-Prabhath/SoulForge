/**
 * HUD — DOM-based debug overlay.
 *
 * Phase 0: shows FPS, player tile coords, player world coords, realm name.
 * Kept as simple DOM (not React) — the HUD is debug-only and doesn't need
 * a framework. In Phase 5 we'll add a proper UI layer (Zustand + React or
 * vanilla TS components) for the Sanctum.
 */

import { defineQuery } from "bitecs";
import { world, Position, PlayerTag } from "@core/ecs/world";
import { worldToTile } from "@core/iso";

const playerQuery = defineQuery([Position, PlayerTag]);

export class HUD {
  private fpsEl: HTMLElement;
  private tileEl: HTMLElement;
  private pixelEl: HTMLElement;
  private realmEl: HTMLElement;

  private frameCount = 0;
  private fpsAccumulator = 0;
  private fps = 0;

  constructor(realmName: string) {
    this.fpsEl = document.getElementById("hud-fps")!;
    this.tileEl = document.getElementById("hud-tile")!;
    this.pixelEl = document.getElementById("hud-pixel")!;
    this.realmEl = document.getElementById("hud-realm")!;
    this.realmEl.textContent = `${realmName} (Prototype)`;

    document.getElementById("hud")!.style.display = "block";
  }

  update(dt: number) {
    // FPS counter — averaged over 0.25s windows
    this.frameCount++;
    this.fpsAccumulator += dt;
    if (this.fpsAccumulator >= 0.25) {
      this.fps = Math.round(this.frameCount / this.fpsAccumulator);
      this.frameCount = 0;
      this.fpsAccumulator = 0;
      this.fpsEl.textContent = String(this.fps);
    }

    // Player position
    const players = playerQuery(world);
    if (players.length > 0) {
      const eid = players[0];
      const px = Position.x[eid];
      const py = Position.y[eid];
      this.pixelEl.textContent = `${Math.round(px)}, ${Math.round(py)}`;
      const { col, row } = worldToTile(px, py);
      this.tileEl.textContent = `${Math.floor(col)}, ${Math.floor(row)}`;
    }
  }

  hideLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }
}
