/**
 * HUD — DOM-based debug overlay.
 *
 * Phase 1: shows FPS, player tile/pixel coords, realm name, player HP,
 * Mana Bolt cooldown, and enemy count.
 */

import { defineQuery, hasComponent } from "bitecs";
import {
  world,
  Position,
  PlayerTag,
  Health,
  Cooldown,
  EnemyAI,
} from "@core/ecs/world";
import { worldToTile } from "@core/iso";

const playerQuery = defineQuery([Position, PlayerTag, Health]);
const enemyQuery = defineQuery([EnemyAI, Health]);

export class HUD {
  private fpsEl: HTMLElement;
  private tileEl: HTMLElement;
  private pixelEl: HTMLElement;
  private realmEl: HTMLElement;
  private hpEl: HTMLElement;
  private hpBarEl: HTMLElement;
  private cdEl: HTMLElement;
  private cdBarEl: HTMLElement;
  private enemyEl: HTMLElement;

  private frameCount = 0;
  private fpsAccumulator = 0;
  private fps = 0;

  constructor(realmName: string) {
    this.fpsEl = document.getElementById("hud-fps")!;
    this.tileEl = document.getElementById("hud-tile")!;
    this.pixelEl = document.getElementById("hud-pixel")!;
    this.realmEl = document.getElementById("hud-realm")!;
    this.hpEl = document.getElementById("hud-hp")!;
    this.hpBarEl = document.getElementById("hud-hp-bar")!;
    this.cdEl = document.getElementById("hud-cd")!;
    this.cdBarEl = document.getElementById("hud-cd-bar")!;
    this.enemyEl = document.getElementById("hud-enemies")!;
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

    // Player position + HP + cooldown
    const players = playerQuery(world);
    if (players.length > 0) {
      const eid = players[0];
      const px = Position.x[eid];
      const py = Position.y[eid];
      this.pixelEl.textContent = `${Math.round(px)}, ${Math.round(py)}`;
      const { col, row } = worldToTile(px, py);
      this.tileEl.textContent = `${Math.floor(col)}, ${Math.floor(row)}`;

      // HP
      const hp = Math.round(Health.current[eid]);
      const hpMax = Math.round(Health.max[eid]);
      this.hpEl.textContent = `${hp} / ${hpMax}`;
      const hpRatio = Math.max(0, Math.min(1, hp / hpMax));
      (this.hpBarEl as HTMLElement).style.width = `${hpRatio * 100}%`;

      // Cooldown
      if (hasComponent(world, Cooldown, eid)) {
        const cd = Cooldown.current[eid];
        const cdMax = Cooldown.max[eid];
        if (cd > 0) {
          this.cdEl.textContent = `${cd.toFixed(2)}s`;
          (this.cdBarEl as HTMLElement).style.width = `${
            (cd / cdMax) * 100
          }%`;
          (this.cdBarEl as HTMLElement).style.background = "#6666a0";
        } else {
          this.cdEl.textContent = "Ready";
          (this.cdBarEl as HTMLElement).style.width = "100%";
          (this.cdBarEl as HTMLElement).style.background = "#ffb86c";
        }
      }
    } else {
      this.hpEl.textContent = "DEAD";
      (this.hpBarEl as HTMLElement).style.width = "0%";
    }

    // Enemy count
    const enemies = enemyQuery(world);
    let alive = 0;
    for (let i = 0; i < enemies.length; i++) {
      if (Health.current[enemies[i]] > 0) alive++;
    }
    this.enemyEl.textContent = String(alive);
  }

  hideLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }
}
