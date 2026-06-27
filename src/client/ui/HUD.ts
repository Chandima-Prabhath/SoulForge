/**
 * HUD — Game-style minimal HUD.
 *
 * Phase 6.5 Redesign: replaced the dashboard-style info panel with a
 * proper game HUD that doesn't block the view.
 *
 * Layout:
 *   - Top-left: Realm name + depth badge + slim health bar
 *   - Top-right: Devour count + unlocked atoms (compact)
 *   - Top-center: Voice of the World (floating text, no box)
 *   - Bottom-center: Skill bar (4 slots, MOBA-style)
 *   - Bottom-left: Devour skill button (circular, cooldown ring)
 *   - Bottom-right: Sanctum button (compact icon)
 *   - Debug overlay: toggle with F3 (FPS, tile, pos, enemies)
 *   - Death screen: full overlay when player dies
 *
 * Mobile responsive: elements shrink and reposition on small screens.
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
import { getSkill } from "@core/ecs/systems/skillSystems";
import { getDevourProgressSummary } from "@core/ecs/systems/devourSystems";
import { ELEMENTS, FORMS, VECTORS, MODIFIERS } from "@data/grammar";

const playerQuery = defineQuery([Position, PlayerTag, Health, SkillSlot]);
const enemyQuery = defineQuery([EnemyAI, Health]);
const voiceQuery = defineQuery([VoiceOfTheWorld]);

export class HUD {
  // Elements
  private realmEl: HTMLElement;
  private depthEl: HTMLElement;
  private healthFill: HTMLElement;
  private healthText: HTMLElement;
  private devourNum: HTMLElement;
  private unlockedEl: HTMLElement;
  private voiceEl: HTMLElement;
  private debugEl: HTMLElement;
  private deathEl: HTMLElement;
  private skillSlots: HTMLElement[] = [];
  private devourBtn: HTMLElement;

  // Debug elements
  private fpsEl: HTMLElement;
  private tileEl: HTMLElement;
  private pixelEl: HTMLElement;
  private enemiesEl: HTMLElement;

  // State
  private frameCount = 0;
  private fpsAccumulator = 0;
  private fps = 0;
  private debugVisible = false;

  constructor(realmName: string) {
    this.realmEl = document.getElementById("hud-realm")!;
    this.depthEl = document.getElementById("hud-depth")!;
    this.healthFill = document.getElementById("hud-health-fill")!;
    this.healthText = document.getElementById("hud-health-text")!;
    this.devourNum = document.getElementById("hud-devour-num")!;
    this.unlockedEl = document.getElementById("hud-unlocked")!;
    this.voiceEl = document.getElementById("hud-voice")!;
    this.debugEl = document.getElementById("hud-debug")!;
    this.deathEl = document.getElementById("hud-death")!;
    this.devourBtn = document.getElementById("hud-devour-btn")!;

    this.fpsEl = document.getElementById("hud-fps")!;
    this.tileEl = document.getElementById("hud-tile")!;
    this.pixelEl = document.getElementById("hud-pixel")!;
    this.enemiesEl = document.getElementById("hud-enemies")!;

    // Cache skill slot elements
    for (let i = 0; i < 4; i++) {
      const slot = document.getElementById(`skill-slot-${i}`);
      if (slot) this.skillSlots.push(slot);
    }

    // Show all HUD elements
    this.realmEl.textContent = realmName;
    this.showHudElements();

    // F3 to toggle debug
    window.addEventListener("keydown", (e) => {
      if (e.key === "F3") {
        e.preventDefault();
        this.debugVisible = !this.debugVisible;
        this.debugEl.style.display = this.debugVisible ? "block" : "none";
      }
    });
  }

  private showHudElements() {
    const ids = [
      "hud-topleft", "hud-topright", "hud-skillbar",
      "hud-devour-btn", "hud-sanctum-btn"
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = el.style.display === "none" ? "flex" : el.style.display;
    }
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

      // Health
      const hp = Math.round(Health.current[eid]);
      const hpMax = Math.round(Health.max[eid]);
      const hpRatio = Math.max(0, Math.min(1, hp / hpMax));
      this.healthFill.style.width = `${hpRatio * 100}%`;
      this.healthText.textContent = `${hp}/${hpMax}`;

      // Hide death screen
      this.deathEl.style.display = "none";

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
        const slot = this.skillSlots[i];
        if (!slot) continue;

        const skillIdx = skillIndices[i];
        const cd = cds[i];
        const cdMax = cdMaxes[i];

        if (skillIdx < 0) {
          slot.classList.add("empty");
          slot.classList.remove("ready");
          const nameEl = slot.querySelector(".skill-name") as HTMLElement;
          if (nameEl) nameEl.textContent = "—";
          const cdOverlay = slot.querySelector(".cooldown-overlay") as HTMLElement;
          if (cdOverlay) cdOverlay.style.height = "0%";
          const cdText = slot.querySelector(".cooldown-text") as HTMLElement;
          if (cdText) cdText.style.display = "none";
          continue;
        }

        slot.classList.remove("empty");
        const skill = getSkill(skillIdx);
        if (skill) {
          const nameEl = slot.querySelector(".skill-name") as HTMLElement;
          if (nameEl) nameEl.textContent = skill.name;

          // Set icon based on element
          const iconEl = slot.querySelector(".skill-icon") as HTMLElement;
          if (iconEl) {
            const elementColors = ["✦", "🔥", "❄", "⚡", "🕳"];
            iconEl.textContent = elementColors[skill.element] || "✦";
          }
        }

        const cdOverlay = slot.querySelector(".cooldown-overlay") as HTMLElement;
        const cdText = slot.querySelector(".cooldown-text") as HTMLElement;

        if (cd > 0) {
          slot.classList.remove("ready");
          if (cdOverlay) {
            const cdRatio = cd / cdMax;
            cdOverlay.style.height = `${cdRatio * 100}%`;
          }
          if (cdText) {
            cdText.textContent = cd > 1 ? Math.ceil(cd).toString() : cd.toFixed(1);
            cdText.style.display = "block";
          }
        } else {
          slot.classList.add("ready");
          if (cdOverlay) cdOverlay.style.height = "0%";
          if (cdText) cdText.style.display = "none";
        }
      }

      // Devour cooldown
      if (hasComponent(world, Cooldown, eid)) {
        const cd = Cooldown.current[eid];
        const cdMax = Cooldown.max[eid];
        const cdOverlay = this.devourBtn.querySelector(".cooldown-overlay") as HTMLElement;
        const cdText = this.devourBtn.querySelector(".cooldown-text") as HTMLElement;

        if (cd > 0) {
          if (cdOverlay) {
            const cdRatio = cd / cdMax;
            cdOverlay.style.height = `${cdRatio * 100}%`;
          }
          if (cdText) {
            cdText.textContent = cd > 1 ? Math.ceil(cd).toString() : cd.toFixed(1);
            cdText.style.display = "block";
          }
          this.devourBtn.style.borderColor = "rgba(208,160,255,0.2)";
        } else {
          if (cdOverlay) cdOverlay.style.height = "0%";
          if (cdText) cdText.style.display = "none";
          this.devourBtn.style.borderColor = "rgba(208,160,255,0.6)";
        }
      }

      // Devour progress
      if (hasComponent(world, DevourProgress, eid)) {
        const summary = getDevourProgressSummary(eid);
        this.devourNum.textContent = String(summary.totalDevoured);
        const unlockedStr =
          `E: ${summary.elements.join("/") || "—"}  ` +
          `F: ${summary.forms.join("/") || "—"}  ` +
          `V: ${summary.vectors.join("/") || "—"}` +
          (summary.modifiers.length > 0 ? `  M: ${summary.modifiers.join("/")}` : "");
        this.unlockedEl.textContent = unlockedStr;
      }

      // Debug info
      const px = Position.x[eid];
      const py = Position.y[eid];
      this.pixelEl.textContent = `${Math.round(px)}, ${Math.round(py)}`;
      const { col, row } = worldToTile(px, py);
      this.tileEl.textContent = `${Math.floor(col)}, ${Math.floor(row)}`;
    } else {
      // Player is dead — show death screen
      this.deathEl.style.display = "flex";
      this.healthFill.style.width = "0%";
      this.healthText.textContent = "0/0";
    }

    // Enemy count
    const enemies = enemyQuery(world);
    let alive = 0;
    for (let i = 0; i < enemies.length; i++) {
      if (Health.current[enemies[i]] > 0) alive++;
    }
    this.enemiesEl.textContent = String(alive);

    // Voice of the World
    const voices = voiceQuery(world);
    if (voices.length > 0) {
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
      case 1: return `✦ ${atomName} element unlocked`;
      case 2: return `✦ ${atomName} form unlocked`;
      case 3: return `✦ ${atomName} vector unlocked`;
      case 4: return `✦ ${atomName} modifier unlocked`;
      case 5: return "Analysis complete.";
      case 6: return "[Devour] activated";
      case 7: return "Entering a new realm...";
      case 8: return "You died.";
      case 9: return "✦ Realm Cleared! Press R to descend ✦";
      case 10: return "✦ VICTORY! ✦";
      case 11: return "✦ DEFEAT ✦";
      default: return "";
    }
  }

  setRealmName(name: string) {
    this.realmEl.textContent = name;
  }

  updateRunState(depth: number, _totalDevoured: number) {
    this.depthEl.textContent = String(depth);
  }

  hideLoading() {
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }
}
