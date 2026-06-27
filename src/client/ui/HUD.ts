/**
 * HUD — DOM-based debug overlay.
 *
 * Phase 3: shows FPS, player tile/pixel coords, realm name, player HP,
 * 4 skill slots, Devour cooldown, enemy count, devour progress (unlocked atoms),
 * and Voice of the World notifications.
 */

import { defineQuery, hasComponent } from "bitecs";
import {
  world,
  Position,
  PlayerTag,
  Health,
  EnemyAI,
  SkillSlot,
  Cooldown,
  DevourProgress,
  VoiceOfTheWorld,
} from "@core/ecs/world";
import { worldToTile } from "@core/iso";
import { getSkill, getSkillStats } from "@core/ecs/systems/skillSystems";
import { getDevourProgressSummary } from "@core/ecs/systems/devourSystems";
import { ELEMENTS, FORMS, VECTORS, MODIFIERS } from "@data/grammar";

const playerQuery = defineQuery([Position, PlayerTag, Health, SkillSlot]);
const enemyQuery = defineQuery([EnemyAI, Health]);
const voiceQuery = defineQuery([VoiceOfTheWorld]);

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
  private devourCdEl: HTMLElement;
  private devourCdBarEl: HTMLElement;
  private devourCountEl: HTMLElement;
  private unlockedEl: HTMLElement;
  private voiceEl: HTMLElement;

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
    this.devourCdEl = document.getElementById("hud-devour-cd")!;
    this.devourCdBarEl = document.getElementById("hud-devour-bar")!;
    this.devourCountEl = document.getElementById("hud-devour-count")!;
    this.unlockedEl = document.getElementById("hud-unlocked")!;
    this.voiceEl = document.getElementById("hud-voice")!;
    this.realmEl.textContent = `${realmName} (Prototype)`;

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
      }

      // Devour cooldown (uses generic Cooldown component)
      if (hasComponent(world, Cooldown, eid)) {
        const cd = Cooldown.current[eid];
        const cdMax = Cooldown.max[eid];
        if (cd > 0) {
          this.devourCdEl.textContent = `${cd.toFixed(1)}s`;
          (this.devourCdBarEl as HTMLElement).style.width = `${(cd / cdMax) * 100}%`;
          (this.devourCdBarEl as HTMLElement).style.background = "#9040ff";
        } else {
          this.devourCdEl.textContent = "Ready";
          (this.devourCdBarEl as HTMLElement).style.width = "100%";
          (this.devourCdBarEl as HTMLElement).style.background = "#d0a0ff";
        }
      }

      // Devour progress
      if (hasComponent(world, DevourProgress, eid)) {
        const summary = getDevourProgressSummary(eid);
        this.devourCountEl.textContent = String(summary.totalDevoured);
        this.unlockedEl.textContent =
          `E: ${summary.elements.join("/") || "—"}  ` +
          `F: ${summary.forms.join("/") || "—"}  ` +
          `V: ${summary.vectors.join("/") || "—"}  ` +
          `M: ${summary.modifiers.join("/") || "—"}`;
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

    // Voice of the World — show the most recent notification
    const voices = voiceQuery(world);
    if (voices.length > 0) {
      // Find the youngest voice (highest age but not expired)
      let youngest = voices[0];
      for (let i = 1; i < voices.length; i++) {
        if (VoiceOfTheWorld.age[voices[i]] < VoiceOfTheWorld.age[youngest]) {
          youngest = voices[i];
        }
      }
      const msg = this.formatVoiceMessage(youngest);
      this.voiceEl.textContent = msg;
      const age = VoiceOfTheWorld.age[youngest];
      const ttl = VoiceOfTheWorld.ttl[youngest];
      const fadeT = Math.min(1, age / ttl);
      this.voiceEl.style.opacity = String(1 - fadeT * fadeT);
      this.voiceEl.style.display = "block";
    } else {
      this.voiceEl.style.display = "none";
    }
  }

  private formatVoiceMessage(eid: number): string {
    const messageId = VoiceOfTheWorld.messageId[eid];
    const atomType = VoiceOfTheWorld.atomType[eid];
    const atomId = VoiceOfTheWorld.atomId[eid];

    let atomName = "";
    if (atomType === 1) atomName = ELEMENTS[atomId as 0 | 1 | 2 | 3 | 4]?.name ?? "";
    else if (atomType === 2) atomName = FORMS[atomId as 0 | 1 | 2]?.name ?? "";
    else if (atomType === 3) atomName = VECTORS[atomId as 0 | 1 | 2]?.name ?? "";
    else if (atomType === 4) atomName = MODIFIERS[atomId as 0 | 1 | 2 | 3 | 4]?.name ?? "";

    switch (messageId) {
      case 0: return "Essence devoured.";
      case 1: return `New element unlocked: ${atomName}`;
      case 2: return `New form unlocked: ${atomName}`;
      case 3: return `New vector unlocked: ${atomName}`;
      case 4: return `New modifier unlocked: ${atomName}`;
      case 5: return "Analysis complete.";
      case 6: return "[Devour] activated.";
      case 7: return "Entering a new realm...";
      case 8: return "You died. Press R to descend.";
      case 9: return "✦ Realm Cleared! Press R to descend. ✦";
      default: return "";
    }
  }

  /**
   * Set the realm name displayed in the HUD (called on realm transition).
   */
  setRealmName(name: string) {
    this.realmEl.textContent = `${name} (Depth varies)`;
  }

  /**
   * Update the HUD with run state info (depth, total devoured).
   */
  updateRunState(depth: number, totalDevoured: number) {
    // Update the realm display to show depth
    if (this.realmEl.textContent && !this.realmEl.textContent.includes("Depth")) {
      this.realmEl.textContent = this.realmEl.textContent.replace(" (Prototype)", "");
    }
    // Could add a separate depth display here in the future
    void depth;
    void totalDevoured;
  }

  hideLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }
}
