/**
 * HUD — DOM-based debug overlay.
 *
 * Phase 2: shows FPS, player tile/pixel coords, realm name, player HP,
 * 4 skill slots with name + cooldown + ready indicator, and enemy count.
 */

import { defineQuery, hasComponent } from "bitecs";
import {
  world,
  Position,
  PlayerTag,
  Health,
  EnemyAI,
  SkillSlot,
} from "@core/ecs/world";
import { worldToTile } from "@core/iso";
import { getSkill, getSkillStats } from "@core/ecs/systems/skillSystems";

const playerQuery = defineQuery([Position, PlayerTag, Health, SkillSlot]);
const enemyQuery = defineQuery([EnemyAI, Health]);

interface SlotEl {
  name: HTMLElement;
  cd: HTMLElement;
  cdBar: HTMLElement;
  key: HTMLElement;
}

export class HUD {
  private fpsEl: HTMLElement;
  private tileEl: HTMLElement;
  private pixelEl: HTMLElement;
  private realmEl: HTMLElement;
  private hpEl: HTMLElement;
  private hpBarEl: HTMLElement;
  private enemyEl: HTMLElement;
  private slotEls: SlotEl[] = [];

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
    this.enemyEl = document.getElementById("hud-enemies")!;
    this.realmEl.textContent = `${realmName} (Prototype)`;

    // Cache slot elements
    for (let i = 0; i < 4; i++) {
      this.slotEls.push({
        name: document.getElementById(`hud-slot${i}-name`)!,
        cd: document.getElementById(`hud-slot${i}-cd`)!,
        cdBar: document.getElementById(`hud-slot${i}-bar`)!,
        key: document.getElementById(`hud-slot${i}-key`)!,
      });
    }

    document.getElementById("hud")!.style.display = "block";
  }

  update(dt: number) {
    // FPS counter
    this.frameCount++;
    this.fpsAccumulator += dt;
    if (this.fpsAccumulator >= 0.25) {
      this.fps = Math.round(this.frameCount / this.fpsAccumulator);
      this.frameCount = 0;
      this.fpsAccumulator = 0;
      this.fpsEl.textContent = String(this.fps);
    }

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

      // Skill slots
      const skillIndices = [
        SkillSlot.skillIndex0[eid],
        SkillSlot.skillIndex1[eid],
        SkillSlot.skillIndex2[eid],
        SkillSlot.skillIndex3[eid],
      ];
      const cds = [
        SkillSlot.cd0[eid],
        SkillSlot.cd1[eid],
        SkillSlot.cd2[eid],
        SkillSlot.cd3[eid],
      ];
      const cdMaxes = [
        SkillSlot.cdMax0[eid],
        SkillSlot.cdMax1[eid],
        SkillSlot.cdMax2[eid],
        SkillSlot.cdMax3[eid],
      ];

      for (let i = 0; i < 4; i++) {
        const slot = this.slotEls[i];
        const skillIdx = skillIndices[i];
        if (skillIdx < 0) {
          slot.name.textContent = "(empty)";
          slot.cd.textContent = "--";
          (slot.cdBar as HTMLElement).style.width = "0%";
          slot.key.textContent = String(i + 1);
          continue;
        }
        const skill = getSkill(skillIdx);
        const stats = getSkillStats(skillIdx);
        if (skill && stats) {
          slot.name.textContent = skill.name;
          const cd = cds[i];
          const cdMax = cdMaxes[i];
          if (cd > 0) {
            slot.cd.textContent = `${cd.toFixed(2)}s`;
            (slot.cdBar as HTMLElement).style.width = `${(cd / cdMax) * 100}%`;
            (slot.cdBar as HTMLElement).style.background = "#6666a0";
          } else {
            slot.cd.textContent = "Ready";
            (slot.cdBar as HTMLElement).style.width = "100%";
            (slot.cdBar as HTMLElement).style.background = "#ffb86c";
          }
        }
        slot.key.textContent = String(i + 1);
      }
    } else {
      this.hpEl.textContent = "DEAD";
      (this.hpBarEl as HTMLElement).style.width = "0%";
      for (let i = 0; i < 4; i++) {
        this.slotEls[i].name.textContent = "--";
        this.slotEls[i].cd.textContent = "--";
        (this.slotEls[i].cdBar as HTMLElement).style.width = "0%";
      }
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

// Suppress unused import warning for hasComponent — kept for future use
void hasComponent;
