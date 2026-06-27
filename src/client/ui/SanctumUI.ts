/**
 * Sanctum UI — DOM-based overlay for the hub between realms.
 *
 * The Sanctum is where the player:
 *   - Crafts new skills from unlocked atoms
 *   - Synthesizes two skills into a new one
 *   - Manages their grimoire (view all owned skills)
 *   - Equips skills to their 4 slots
 *   - Descends to the next realm
 *
 * This is a full-screen DOM overlay (not PixiJS). The game pauses while
 * the Sanctum is open. The player returns to realm mode by clicking "Descend".
 *
 * Design: dark fantasy, anime-styled panels. Purple/gold accents to match
 * the SoulForge branding.
 */

import type { RunState } from "@core/realm/runState";
import {
  addCraftedSkill,
  equipSkill,
  synthesizeSkills,
} from "@core/realm/runState";
import type {
  SkillDefinition,
  ElementId,
  FormId,
  VectorId,
  ModifierId,
} from "@core/grammar/types";
import { ELEMENTS, FORMS, VECTORS, MODIFIERS } from "@data/grammar";
import { SAGE_LINES, getRandomDeathQuote } from "@data/narrative";
import { computeSkillStats, describeSkill } from "@core/grammar/compute";

export class SanctumUI {
  private container: HTMLElement;
  private runState: RunState;
  private onDescendCallback: () => void;

  // Crafting state
  private craftElement: ElementId | null = null;
  private craftForm: FormId | null = null;
  private craftVector: VectorId | null = null;
  private craftModifiers: (ModifierId | null)[] = [null, null, null];

  // Synthesis state
  private synthSkillA: number = -1;
  private synthSkillB: number = -1;
  private synthName: string = "";

  constructor(runState: RunState, onDescend: () => void) {
    this.runState = runState;
    this.onDescendCallback = onDescend;
    this.container = document.createElement("div");
    this.container.id = "sanctum-overlay";
    this.container.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(5, 5, 12, 0.97);
      backdrop-filter: blur(12px);
      z-index: 1000;
      display: none;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #e8e8f0;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Show the Sanctum overlay.
   */
  show() {
    this.render();
    this.container.style.display = "block";
  }

  /**
   * Update the RunState reference (called by GameApp when the state changes).
   */
  updateRunState(runState: RunState) {
    this.runState = runState;
  }

  /**
   * Hide the Sanctum overlay.
   */
  hide() {
    this.container.style.display = "none";
  }

  /**
   * Check if the Sanctum is currently visible.
   */
  isVisible(): boolean {
    return this.container.style.display === "block";
  }

  private render() {
    const dp = this.runState.devourProgress;
    const unlockedEls: string[] = [];
    const unlockedForms: string[] = [];
    const unlockedVecs: string[] = [];
    const unlockedMods: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (dp.unlockedElements & (1 << i)) unlockedEls.push(ELEMENTS[i as ElementId].name);
      if (dp.unlockedModifiers & (1 << i)) unlockedMods.push(MODIFIERS[i as ModifierId].name);
    }
    for (let i = 0; i < 3; i++) {
      if (dp.unlockedForms & (1 << i)) unlockedForms.push(FORMS[i as FormId].name);
      if (dp.unlockedVectors & (1 << i)) unlockedVecs.push(VECTORS[i as VectorId].name);
    }

    this.container.innerHTML = `
      <div style="max-width: 1100px; margin: 0 auto; padding: 30px 20px;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 32px; color: #ffb86c; letter-spacing: 0.1em; margin: 0 0 8px 0; text-shadow: 0 0 20px rgba(255,184,108,0.3);">
            ✦ THE SANCTUM ✦
          </h1>
          <p style="color: #8888a0; font-size: 14px; margin: 0;">
            Depth ${this.runState.depth} • ${dp.totalDevoured} devoured • ${this.runState.ownedSkills.length} skills in grimoire
          </p>
          <div style="margin-top: 12px; font-size: 12px; color: #8888a0;">
            <span style="color:#e0e0e8;">Elements:</span> ${unlockedEls.join(", ") || "—"} &nbsp;|&nbsp;
            <span style="color:#e0e0e8;">Forms:</span> ${unlockedForms.join(", ") || "—"} &nbsp;|&nbsp;
            <span style="color:#e0e0e8;">Vectors:</span> ${unlockedVecs.join(", ") || "—"} &nbsp;|&nbsp;
            <span style="color:#e0e0e8;">Modifiers:</span> ${unlockedMods.join(", ") || "—"}
          </div>
        </div>

        <!-- Sage Dialogue -->
        ${this.renderSageSection()}

        <!-- Two-column layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">

          <!-- Left column: Crafting + Synthesis -->
          <div>
            ${this.renderCraftingSection()}
            ${this.renderSynthesisSection()}
          </div>

          <!-- Right column: Grimoire + Equip -->
          <div>
            ${this.renderGrimoireSection()}
            ${this.renderEquipSection()}
          </div>
        </div>

        <!-- Descend button -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);">
          <button id="sanctum-descend" style="
            background: linear-gradient(135deg, #ffb86c 0%, #ff6020 100%);
            color: #0a0a0f;
            border: none;
            padding: 14px 40px;
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 0.1em;
            border-radius: 8px;
            cursor: pointer;
            text-transform: uppercase;
            box-shadow: 0 4px 20px rgba(255,184,108,0.4);
            transition: transform 0.15s, box-shadow 0.15s;
          "
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 25px rgba(255,184,108,0.6)';"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 20px rgba(255,184,108,0.4)';"
          >
            ⚔ Descend to Depth ${this.runState.depth}
          </button>
          <p style="color: #8888a0; font-size: 12px; margin-top: 8px;">
            Your progress is saved. Crafted skills persist through death.
          </p>
        </div>
      </div>
    `;

    this.attachListeners();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Crafting Section
  // ─────────────────────────────────────────────────────────────────────────────

  private renderCraftingSection(): string {
    const dp = this.runState.devourProgress;
    return `
      <div style="background: rgba(20,20,35,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <h2 style="font-size: 16px; color: #ffb86c; margin: 0 0 16px 0; letter-spacing: 0.05em;">⚒ CRAFT SKILL</h2>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 6px;">Element</label>
          <div id="craft-elements" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${this.renderAtomButtons("element", 5, dp.unlockedElements)}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 6px;">Form</label>
          <div id="craft-forms" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${this.renderAtomButtons("form", 3, dp.unlockedForms)}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 6px;">Vector</label>
          <div id="craft-vectors" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${this.renderAtomButtons("vector", 3, dp.unlockedVectors)}
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 6px;">Modifiers (up to 3)</label>
          <div id="craft-modifiers" style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${this.renderAtomButtons("modifier", 5, dp.unlockedModifiers)}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 6px;">Skill Name</label>
          <input id="craft-name" type="text" placeholder="Name your skill..." style="
            width: 100%; box-sizing: border-box; padding: 8px 12px;
            background: rgba(10,10,20,0.8); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px; color: #e8e8f0; font-size: 13px;
          " />
        </div>

        <div id="craft-preview" style="
          background: rgba(10,10,20,0.5); border-radius: 6px; padding: 12px;
          margin-bottom: 12px; font-size: 12px; color: #8888a0;
          border: 1px solid rgba(255,255,255,0.05);
        ">
          Select atoms to preview your skill...
        </div>

        <button id="craft-create" disabled style="
          width: 100%; padding: 10px;
          background: rgba(144,64,255,0.3); color: #d0a0ff;
          border: 1px solid rgba(144,64,255,0.5); border-radius: 6px;
          font-size: 13px; font-weight: bold; cursor: pointer;
          letter-spacing: 0.05em;
        ">Forge Skill</button>
      </div>
    `;
  }

  private renderAtomButtons(
    type: "element" | "form" | "vector" | "modifier",
    count: number,
    unlockedMask: number
  ): string {
    let buttons = "";
    for (let i = 0; i < count; i++) {
      const isUnlocked = (unlockedMask & (1 << i)) !== 0;
      let name = "";
      let color = "#8888a0";
      if (type === "element") {
        name = ELEMENTS[i as ElementId].name;
        color = `#${ELEMENTS[i as ElementId].color.toString(16).padStart(6, "0")}`;
      } else if (type === "form") {
        name = FORMS[i as FormId].name;
      } else if (type === "vector") {
        name = VECTORS[i as VectorId].name;
      } else {
        name = MODIFIERS[i as ModifierId].name;
      }

      if (isUnlocked) {
        buttons += `
          <button class="atom-btn" data-type="${type}" data-id="${i}" style="
            padding: 6px 12px; font-size: 12px;
            background: rgba(20,20,35,0.8); color: ${type === "element" ? color : "#e8e8f0"};
            border: 1px solid ${type === "element" ? color + "60" : "rgba(255,255,255,0.15)"};
            border-radius: 4px; cursor: pointer; transition: all 0.15s;
          ">${name}</button>
        `;
      } else {
        buttons += `
          <span style="
            padding: 6px 12px; font-size: 12px;
            background: rgba(10,10,15,0.5); color: #444450;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 4px;
          ">??? (devour to unlock)</span>
        `;
      }
    }
    return buttons;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Synthesis Section
  // ─────────────────────────────────────────────────────────────────────────────

  private renderSynthesisSection(): string {
    const skills = this.runState.ownedSkills;
    const skillOptions = skills.map((s, i) => `<option value="${i}">${s.name}</option>`).join("");

    return `
      <div style="background: rgba(20,20,35,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px;">
        <h2 style="font-size: 16px; color: #ffb86c; margin: 0 0 16px 0; letter-spacing: 0.05em;">⚡ SYNTHESIZE</h2>
        <p style="font-size: 11px; color: #8888a0; margin: 0 0 12px 0;">
          Combine two skills: takes Element+Vector from A, Form from B, merges modifiers.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div>
            <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 4px;">Skill A</label>
            <select id="synth-a" style="width: 100%; padding: 6px; background: rgba(10,10,20,0.8); color: #e8e8f0; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; font-size: 12px;">
              <option value="-1">— select —</option>
              ${skillOptions}
            </select>
          </div>
          <div>
            <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 4px;">Skill B</label>
            <select id="synth-b" style="width: 100%; padding: 6px; background: rgba(10,10,20,0.8); color: #e8e8f0; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; font-size: 12px;">
              <option value="-1">— select —</option>
              ${skillOptions}
            </select>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size: 11px; color: #8888a0; display: block; margin-bottom: 4px;">New Skill Name</label>
          <input id="synth-name" type="text" placeholder="Synthesized skill name..." style="
            width: 100%; box-sizing: border-box; padding: 8px 12px;
            background: rgba(10,10,20,0.8); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px; color: #e8e8f0; font-size: 13px;
          " />
        </div>

        <div id="synth-preview" style="
          background: rgba(10,10,20,0.5); border-radius: 6px; padding: 12px;
          margin-bottom: 12px; font-size: 12px; color: #8888a0;
          border: 1px solid rgba(255,255,255,0.05);
        ">
          Select two skills to preview synthesis...
        </div>

        <button id="synth-create" disabled style="
          width: 100%; padding: 10px;
          background: rgba(144,64,255,0.3); color: #d0a0ff;
          border: 1px solid rgba(144,64,255,0.5); border-radius: 6px;
          font-size: 13px; font-weight: bold; cursor: pointer;
        ">Synthesize</button>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Grimoire Section
  // ─────────────────────────────────────────────────────────────────────────────
  // Sage Dialogue Section — the Inner Sage speaks to the player
  // ─────────────────────────────────────────────────────────────────────────────

  private renderSageSection(): string {
    const dp = this.runState.devourProgress;
    let condition: "first_sanctum" | "return_sanctum" | "low_atoms" | "many_atoms" | "boss_killed" = "return_sanctum";

    if (!this.runState.hasDied) {
      condition = "first_sanctum";
    } else if (dp.totalDevoured < 3) {
      condition = "low_atoms";
    } else if (dp.totalDevoured >= 8) {
      condition = "many_atoms";
    }

    const sageLine = SAGE_LINES.find((l) => l.condition === condition);
    const dialogue = sageLine?.text ?? SAGE_LINES[0].text;
    const deathQuote = this.runState.hasDied ? getRandomDeathQuote() : null;

    return `
      <div style="
        background: linear-gradient(135deg, rgba(30,20,45,0.8) 0%, rgba(20,15,30,0.8) 100%);
        border: 1px solid rgba(144,64,255,0.3);
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle at 30% 50%, rgba(144,64,255,0.08) 0%, transparent 70%);
          pointer-events: none;
        "></div>
        <div style="display: flex; align-items: flex-start; gap: 16px; position: relative;">
          <div style="
            width: 48px; height: 48px;
            border-radius: 50%;
            background: radial-gradient(circle, #d0a0ff 0%, #9040ff 60%, #4a2060 100%);
            border: 2px solid #d0a0ff;
            box-shadow: 0 0 20px rgba(144,64,255,0.4);
            flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px;
          ">✦</div>
          <div style="flex: 1;">
            <div style="
              color: #d0a0ff;
              font-size: 12px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              margin-bottom: 8px;
              font-weight: 600;
            ">Inner Sage</div>
            <div style="
              color: #e8e8f0;
              font-size: 14px;
              line-height: 1.6;
              font-family: Georgia, serif;
              font-style: italic;
            ">${dialogue}</div>
            ${deathQuote ? `
              <div style="
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid rgba(255,255,255,0.08);
                color: #ff8080;
                font-size: 12px;
                font-family: Georgia, serif;
                font-style: italic;
                opacity: 0.8;
              ">${deathQuote}</div>
            ` : ""}
          </div>
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private renderGrimoireSection(): string {
    const skills = this.runState.ownedSkills;
    const skillList = skills.map((s, i) => {
      const desc = describeSkill(s);
      const stats = computeSkillStats(s);
      const isEquipped = this.runState.equippedSkillIndices.includes(i);
      return `
        <div style="
          background: rgba(10,10,20,0.5); border: 1px solid ${isEquipped ? "rgba(255,184,108,0.4)" : "rgba(255,255,255,0.05)"};
          border-radius: 6px; padding: 10px; margin-bottom: 6px;
          font-size: 12px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #e8e8f0; font-weight: 600;">${s.name} ${isEquipped ? "✓" : ""}</span>
            <span style="color: #8888a0; font-size: 10px;">${stats.damage.toFixed(0)} dmg • ${stats.cooldown.toFixed(2)}s cd</span>
          </div>
          <div style="color: #8888a0; font-size: 10px; margin-top: 2px;">${desc}</div>
        </div>
      `;
    }).join("");

    return `
      <div style="background: rgba(20,20,35,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <h2 style="font-size: 16px; color: #ffb86c; margin: 0 0 16px 0; letter-spacing: 0.05em;">📖 GRIMOIRE (${skills.length})</h2>
        <div style="max-height: 250px; overflow-y: auto;">
          ${skillList || "<p style='color:#8888a0;font-size:12px;'>No skills yet.</p>"}
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Equip Section
  // ─────────────────────────────────────────────────────────────────────────────

  private renderEquipSection(): string {
    const slots = [0, 1, 2, 3];
    const slotHtml = slots.map((slot) => {
      const idx = this.runState.equippedSkillIndices[slot];
      const skill = idx >= 0 ? this.runState.ownedSkills[idx] : null;
      void skill; // used for potential future display
      return `
        <div style="background: rgba(10,10,20,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 10px;">
          <div style="font-size: 10px; color: #ffb86c; margin-bottom: 4px;">SLOT ${slot + 1}</div>
          <select class="equip-select" data-slot="${slot}" style="width: 100%; padding: 4px; background: rgba(10,10,20,0.8); color: #e8e8f0; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; font-size: 11px;">
            <option value="-1">— empty —</option>
            ${this.runState.ownedSkills.map((s, i) => `<option value="${i}" ${idx === i ? "selected" : ""}>${s.name}</option>`).join("")}
          </select>
        </div>
      `;
    }).join("");

    return `
      <div style="background: rgba(20,20,35,0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px;">
        <h2 style="font-size: 16px; color: #ffb86c; margin: 0 0 16px 0; letter-spacing: 0.05em;">⚔ EQUIP SKILLS</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${slotHtml}
        </div>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Listeners
  // ─────────────────────────────────────────────────────────────────────────────

  private attachListeners() {
    // Descend button
    const descendBtn = document.getElementById("sanctum-descend");
    if (descendBtn) {
      descendBtn.onclick = () => {
        this.hide();
        this.onDescendCallback();
      };
    }

    // Atom selection buttons (crafting)
    const atomButtons = this.container.querySelectorAll(".atom-btn");
    atomButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = (e.currentTarget as HTMLElement) || (e.target as HTMLElement);
        // Walk up to find the button element with data-type
        let el = target;
        while (el && !el.dataset.type) el = el.parentElement as HTMLElement;
        if (!el) return;
        const type = el.dataset.type as "element" | "form" | "vector" | "modifier";
        const id = parseInt(el.dataset.id!, 10) as ElementId | FormId | VectorId | ModifierId;
        this.handleAtomSelect(type, id);
      });
    });

    // Craft name input
    const nameInput = document.getElementById("craft-name") as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener("input", () => this.updateCraftPreview());
    }

    // Craft create button
    const createBtn = document.getElementById("craft-create");
    if (createBtn) {
      createBtn.addEventListener("click", () => this.handleCraftCreate());
    }

    // Synthesis selects
    const synthA = document.getElementById("synth-a") as HTMLSelectElement;
    const synthB = document.getElementById("synth-b") as HTMLSelectElement;
    const synthName = document.getElementById("synth-name") as HTMLInputElement;
    if (synthA) synthA.addEventListener("change", () => this.updateSynthPreview());
    if (synthB) synthB.addEventListener("change", () => this.updateSynthPreview());
    if (synthName) synthName.addEventListener("input", () => this.updateSynthPreview());

    // Synth create button
    const synthCreateBtn = document.getElementById("synth-create");
    if (synthCreateBtn) {
      synthCreateBtn.addEventListener("click", () => this.handleSynthCreate());
    }

    // Equip selects
    const equipSelects = this.container.querySelectorAll(".equip-select");
    equipSelects.forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const slot = parseInt(target.dataset.slot!, 10);
        const skillIdx = parseInt(target.value, 10);
        equipSkill(this.runState, slot, skillIdx);
        this.render(); // re-render to update equipped indicators
      });
    });
  }

  private handleAtomSelect(
    type: "element" | "form" | "vector" | "modifier",
    id: ElementId | FormId | VectorId | ModifierId
  ) {
    if (type === "element") {
      this.craftElement = this.craftElement === id ? null : (id as ElementId);
    } else if (type === "form") {
      this.craftForm = this.craftForm === id ? null : (id as FormId);
    } else if (type === "vector") {
      this.craftVector = this.craftVector === id ? null : (id as VectorId);
    } else {
      // Modifier — toggle in the 3 slots
      const existingIdx = this.craftModifiers.indexOf(id as ModifierId);
      if (existingIdx >= 0) {
        this.craftModifiers[existingIdx] = null;
      } else {
        // Find first empty slot
        const emptyIdx = this.craftModifiers.indexOf(null);
        if (emptyIdx >= 0) {
          this.craftModifiers[emptyIdx] = id as ModifierId;
        }
      }
    }
    // Update button selected states + preview WITHOUT full re-render
    this.updateAtomButtonStyles();
    try {
      this.updateCraftPreview();
    } catch (e) {
      console.error('[Sanctum] updateCraftPreview error:', e);
    }
  }

  /**
   * Update the visual selected state of atom buttons without re-rendering.
   */
  private updateAtomButtonStyles() {
    const buttons = this.container.querySelectorAll(".atom-btn");
    buttons.forEach((btn) => {
      const el = btn as HTMLElement;
      const type = el.dataset.type as "element" | "form" | "vector" | "modifier";
      const id = parseInt(el.dataset.id!, 10);
      let isSelected = false;
      if (type === "element") isSelected = this.craftElement === id;
      else if (type === "form") isSelected = this.craftForm === id;
      else if (type === "vector") isSelected = this.craftVector === id;
      else isSelected = this.craftModifiers.includes(id as ModifierId);

      if (isSelected) {
        el.style.background = "rgba(255,184,108,0.3)";
        el.style.borderColor = "#ffb86c";
        el.style.color = "#ffb86c";
      } else {
        el.style.background = "rgba(20,20,35,0.8)";
        el.style.borderColor = el.style.borderColor || "rgba(255,255,255,0.15)";
        el.style.color = el.style.color || "#e8e8f0";
      }
    });
  }

  private updateCraftPreview() {
    const preview = document.getElementById("craft-preview");
    const createBtn = document.getElementById("craft-create") as HTMLButtonElement;
    const nameInput = document.getElementById("craft-name") as HTMLInputElement;

    // Note: use === null instead of !, because ElementId 0 (Force) is falsy
    if (this.craftElement === null || this.craftForm === null || this.craftVector === null) {
      if (preview) preview.textContent = "Select Element, Form, and Vector to preview your skill...";
      if (createBtn) createBtn.disabled = true;
      return;
    }

    const tempSkill: SkillDefinition = {
      id: "preview",
      name: nameInput?.value || "Unnamed",
      element: this.craftElement,
      form: this.craftForm,
      vector: this.craftVector,
      modifiers: this.craftModifiers,
    };
    const stats = computeSkillStats(tempSkill);
    const desc = describeSkill(tempSkill);

    if (preview) {
      preview.innerHTML = `
        <div style="color: #ffb86c; font-weight: bold; margin-bottom: 4px;">${tempSkill.name}</div>
        <div style="color: #8888a0;">${desc}</div>
        <div style="margin-top: 6px; color: #e0e0e8; font-size: 11px;">
          DMG: ${stats.damage.toFixed(1)} • CD: ${stats.cooldown.toFixed(2)}s • Speed: ${stats.speed} • Radius: ${stats.radius}
        </div>
        ${stats.pierceCount > 0 ? '<div style="color:#60c0ff;font-size:10px;">Pierce: ' + stats.pierceCount + "</div>" : ""}
        ${stats.splitOnKill ? '<div style="color:#ff6020;font-size:10px;">Split on kill</div>' : ""}
        ${stats.lingerDuration > 0 ? '<div style="color:#60c0ff;font-size:10px;">Linger: ' + stats.lingerDuration + "s</div>" : ""}
        ${stats.chainCount > 0 ? '<div style="color:#ffe040;font-size:10px;">Chain: ' + stats.chainCount + "</div>" : ""}
        ${stats.growWithDistance ? '<div style="color:#9040ff;font-size:10px;">Grows with distance</div>' : ""}
      `;
    }

    if (createBtn) {
      createBtn.disabled = !nameInput?.value.trim();
    }
  }

  private handleCraftCreate() {
    if (this.craftElement === null || this.craftForm === null || this.craftVector === null) return;
    const nameInput = document.getElementById("craft-name") as HTMLInputElement;
    const name = nameInput?.value.trim();
    if (!name) return;

    const skill: SkillDefinition = {
      id: `craft-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      element: this.craftElement,
      form: this.craftForm,
      vector: this.craftVector,
      modifiers: [...this.craftModifiers],
      description: "Player-crafted skill.",
    };

    addCraftedSkill(this.runState, skill);
    console.log(`%c[Sanctum] %cCrafted: ${skill.name} (${describeSkill(skill)})`, "color: #ffb86c; font-weight: bold;", "color: #e0e0e8;");

    // Reset crafting state
    this.craftElement = null;
    this.craftForm = null;
    this.craftVector = null;
    this.craftModifiers = [null, null, null];
    this.render();
  }

  private updateSynthPreview() {
    const synthA = document.getElementById("synth-a") as HTMLSelectElement;
    const synthB = document.getElementById("synth-b") as HTMLSelectElement;
    const synthName = document.getElementById("synth-name") as HTMLInputElement;
    const preview = document.getElementById("synth-preview");
    const createBtn = document.getElementById("synth-create") as HTMLButtonElement;

    this.synthSkillA = parseInt(synthA?.value || "-1", 10);
    this.synthSkillB = parseInt(synthB?.value || "-1", 10);
    this.synthName = synthName?.value || "";

    if (this.synthSkillA < 0 || this.synthSkillB < 0 || this.synthSkillA === this.synthSkillB) {
      if (preview) preview.textContent = "Select two different skills to preview synthesis...";
      if (createBtn) createBtn.disabled = true;
      return;
    }

    const skillA = this.runState.ownedSkills[this.synthSkillA];
    const skillB = this.runState.ownedSkills[this.synthSkillB];
    const synthesized = synthesizeSkills(skillA, skillB, this.synthName || "Synthesized");
    const stats = computeSkillStats(synthesized);
    const desc = describeSkill(synthesized);

    if (preview) {
      preview.innerHTML = `
        <div style="color: #ffb86c; font-weight: bold; margin-bottom: 4px;">${synthesized.name}</div>
        <div style="color: #8888a0;">${desc}</div>
        <div style="margin-top: 6px; color: #e0e0e8; font-size: 11px;">
          DMG: ${stats.damage.toFixed(1)} • CD: ${stats.cooldown.toFixed(2)}s
        </div>
      `;
    }

    if (createBtn) {
      createBtn.disabled = !this.synthName.trim();
    }
  }

  private handleSynthCreate() {
    if (this.synthSkillA < 0 || this.synthSkillB < 0) return;
    if (!this.synthName.trim()) return;

    const skillA = this.runState.ownedSkills[this.synthSkillA];
    const skillB = this.runState.ownedSkills[this.synthSkillB];
    const synthesized = synthesizeSkills(skillA, skillB, this.synthName.trim());

    addCraftedSkill(this.runState, synthesized);
    console.log(`%c[Sanctum] %cSynthesized: ${synthesized.name}`, "color: #ffb86c; font-weight: bold;", "color: #e0e0e8;");

    // Reset synthesis state
    this.synthSkillA = -1;
    this.synthSkillB = -1;
    this.synthName = "";
    this.render();
  }
}
