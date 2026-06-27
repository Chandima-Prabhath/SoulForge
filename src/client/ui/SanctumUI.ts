/**
 * Sanctum UI — DOM-based overlay for the hub between realms.
 *
 * Phase 6.5 Redesign: simplified UX with progressive disclosure.
 *
 * The Sanctum is a guided experience:
 *   1. Sage welcome (context-aware dialogue)
 *   2. Quick Actions (big buttons: Craft, Synthesize, Equip, Descend)
 *   3. Each action opens a focused modal/panel
 *
 * This is much more intuitive than the previous "everything at once" layout.
 * First-time players see clear guidance; experienced players can move fast.
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

type Panel = "main" | "craft" | "synthesize" | "grimoire" | "equip";

export class SanctumUI {
  private container: HTMLElement;
  private runState: RunState;
  private onDescendCallback: () => void;
  private currentPanel: Panel = "main";

  // Crafting state
  private craftElement: ElementId | null = null;
  private craftForm: FormId | null = null;
  private craftVector: VectorId | null = null;
  private craftModifiers: (ModifierId | null)[] = [null, null, null];

  // Synthesis state
  private synthSkillA: number = -1;
  private synthSkillB: number = -1;

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

  show() {
    this.currentPanel = "main";
    this.render();
    this.container.style.display = "block";
  }

  hide() {
    this.container.style.display = "none";
  }

  isVisible(): boolean {
    return this.container.style.display === "block";
  }

  updateRunState(runState: RunState) {
    this.runState = runState;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────────────────

  private render() {
    switch (this.currentPanel) {
      case "main": this.renderMain(); break;
      case "craft": this.renderCraft(); break;
      case "synthesize": this.renderSynthesize(); break;
      case "grimoire": this.renderGrimoire(); break;
      case "equip": this.renderEquip(); break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main Panel — Sage + Quick Actions
  // ─────────────────────────────────────────────────────────────────────────────

  private renderMain() {
    const dp = this.runState.devourProgress;
    const sageDialogue = this.getSageDialogue();

    this.container.innerHTML = `
      <div style="max-width: 700px; margin: 0 auto; padding: 40px 20px; min-height: 100vh; display: flex; flex-direction: column; justify-content: center;">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 28px; color: #ffb86c; letter-spacing: 0.15em; margin: 0 0 6px 0; text-shadow: 0 0 20px rgba(255,184,108,0.3);">
            ✦ THE SANCTUM ✦
          </h1>
          <p style="color: #8888a0; font-size: 13px; margin: 0;">
            Depth ${this.runState.depth} • ${dp.totalDevoured} devoured • ${this.runState.ownedSkills.length} skills
          </p>
        </div>

        <!-- Sage Dialogue -->
        <div style="
          background: linear-gradient(135deg, rgba(30,20,45,0.8) 0%, rgba(20,15,30,0.8) 100%);
          border: 1px solid rgba(144,64,255,0.3);
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 24px;
        ">
          <div style="display: flex; align-items: flex-start; gap: 16px;">
            <div style="
              width: 44px; height: 44px;
              border-radius: 50%;
              background: radial-gradient(circle, #d0a0ff 0%, #9040ff 60%, #4a2060 100%);
              border: 2px solid #d0a0ff;
              box-shadow: 0 0 15px rgba(144,64,255,0.4);
              flex-shrink: 0;
              display: flex; align-items: center; justify-content: center;
              font-size: 20px;
            ">✦</div>
            <div style="flex: 1;">
              <div style="color: #d0a0ff; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px; font-weight: 600;">Inner Sage</div>
              <div style="color: #e8e8f0; font-size: 14px; line-height: 1.6; font-family: Georgia, serif; font-style: italic;">
                ${sageDialogue}
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Action Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <button class="action-btn" data-panel="craft" style="
            background: linear-gradient(135deg, rgba(255,184,108,0.15) 0%, rgba(255,96,32,0.1) 100%);
            border: 1px solid rgba(255,184,108,0.3);
            border-radius: 10px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.15s;
            text-align: left;
            color: #e8e8f0;
          ">
            <div style="font-size: 24px; margin-bottom: 8px;">⚒</div>
            <div style="font-size: 15px; font-weight: 600; color: #ffb86c; margin-bottom: 4px;">Craft Skill</div>
            <div style="font-size: 11px; color: #8888a0; line-height: 1.4;">Build a new skill from unlocked atoms</div>
          </button>

          <button class="action-btn" data-panel="synthesize" style="
            background: linear-gradient(135deg, rgba(144,64,255,0.15) 0%, rgba(208,160,255,0.1) 100%);
            border: 1px solid rgba(144,64,255,0.3);
            border-radius: 10px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.15s;
            text-align: left;
            color: #e8e8f0;
          ">
            <div style="font-size: 24px; margin-bottom: 8px;">⚡</div>
            <div style="font-size: 15px; font-weight: 600; color: #d0a0ff; margin-bottom: 4px;">Synthesize</div>
            <div style="font-size: 11px; color: #8888a0; line-height: 1.4;">Merge two skills into one</div>
          </button>

          <button class="action-btn" data-panel="grimoire" style="
            background: linear-gradient(135deg, rgba(96,192,255,0.15) 0%, rgba(224,240,255,0.05) 100%);
            border: 1px solid rgba(96,192,255,0.3);
            border-radius: 10px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.15s;
            text-align: left;
            color: #e8e8f0;
          ">
            <div style="font-size: 24px; margin-bottom: 8px;">📖</div>
            <div style="font-size: 15px; font-weight: 600; color: #60c0ff; margin-bottom: 4px;">Grimoire (${this.runState.ownedSkills.length})</div>
            <div style="font-size: 11px; color: #8888a0; line-height: 1.4;">View your owned skills</div>
          </button>

          <button class="action-btn" data-panel="equip" style="
            background: linear-gradient(135deg, rgba(64,255,64,0.1) 0%, rgba(128,255,128,0.05) 100%);
            border: 1px solid rgba(64,255,64,0.2);
            border-radius: 10px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.15s;
            text-align: left;
            color: #e8e8f0;
          ">
            <div style="font-size: 24px; margin-bottom: 8px;">⚔</div>
            <div style="font-size: 15px; font-weight: 600; color: #40ff80; margin-bottom: 4px;">Equip Skills</div>
            <div style="font-size: 11px; color: #8888a0; line-height: 1.4;">Assign skills to your 4 slots</div>
          </button>
        </div>

        <!-- Unlocked Atoms Summary (compact) -->
        <div style="
          background: rgba(15,15,25,0.5);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 24px;
          font-size: 11px;
          color: #8888a0;
        ">
          <span style="color: #e0e0e8; font-weight: 600;">Unlocked:</span>
          ${this.getUnlockedSummary()}
        </div>

        <!-- Descend Button (always visible at bottom) -->
        <button id="sanctum-descend" style="
          width: 100%;
          background: linear-gradient(135deg, #ffb86c 0%, #ff6020 100%);
          color: #0a0a0f;
          border: none;
          padding: 16px;
          font-size: 16px;
          font-weight: bold;
          letter-spacing: 0.1em;
          border-radius: 10px;
          cursor: pointer;
          text-transform: uppercase;
          box-shadow: 0 4px 20px rgba(255,184,108,0.4);
          transition: transform 0.15s;
        ">
          ⚔ Descend to Depth ${this.runState.depth}
        </button>
      </div>
    `;

    this.attachMainListeners();
  }

  private getSageDialogue(): string {
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
    let dialogue = sageLine?.text ?? SAGE_LINES[0].text;

    if (this.runState.hasDied) {
      dialogue += `<br><br><span style="color: #ff8080; font-size: 12px;">${getRandomDeathQuote()}</span>`;
    }

    return dialogue;
  }

  private getUnlockedSummary(): string {
    const dp = this.runState.devourProgress;
    const els: string[] = [];
    const forms: string[] = [];
    const vecs: string[] = [];
    const mods: string[] = [];
    for (let i = 0; i < 5; i++) {
      if (dp.unlockedElements & (1 << i)) els.push(ELEMENTS[i as ElementId].name);
      if (dp.unlockedModifiers & (1 << i)) mods.push(MODIFIERS[i as ModifierId].name);
    }
    for (let i = 0; i < 3; i++) {
      if (dp.unlockedForms & (1 << i)) forms.push(FORMS[i as FormId].name);
      if (dp.unlockedVectors & (1 << i)) vecs.push(VECTORS[i as VectorId].name);
    }
    return `<br>
      <span style="color: #ffb86c;">Elements:</span> ${els.join(", ") || "—"}<br>
      <span style="color: #60c0ff;">Forms:</span> ${forms.join(", ") || "—"} &nbsp;
      <span style="color: #40ff80;">Vectors:</span> ${vecs.join(", ") || "—"}<br>
      <span style="color: #d0a0ff;">Modifiers:</span> ${mods.join(", ") || "—"}`;
  }

  private attachMainListeners() {
    // Action buttons
    const buttons = this.container.querySelectorAll(".action-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = (e.currentTarget as HTMLElement);
        const panel = target.dataset.panel as Panel;
        this.currentPanel = panel;
        this.render();
      });
      // Hover effect
      btn.addEventListener("mouseenter", (e) => {
        const target = e.currentTarget as HTMLElement;
        target.style.transform = "translateY(-2px)";
      });
      btn.addEventListener("mouseleave", (e) => {
        const target = e.currentTarget as HTMLElement;
        target.style.transform = "translateY(0)";
      });
    });

    // Descend button
    const descendBtn = document.getElementById("sanctum-descend");
    if (descendBtn) {
      descendBtn.addEventListener("click", () => {
        this.hide();
        this.onDescendCallback();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Craft Panel
  // ─────────────────────────────────────────────────────────────────────────────

  private renderCraft() {
    const dp = this.runState.devourProgress;
    this.container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
        ${this.renderBackButton()}

        <h2 style="font-size: 22px; color: #ffb86c; margin: 0 0 8px 0;">⚒ Craft a New Skill</h2>
        <p style="color: #8888a0; font-size: 13px; margin: 0 0 24px 0;">
          Select one Element, one Form, one Vector, and up to 3 Modifiers.
          Locked atoms show as ??? — devour enemies to unlock them.
        </p>

        <!-- Step 1: Element -->
        ${this.renderAtomSection("1", "Element", "element", 5, dp.unlockedElements)}

        <!-- Step 2: Form -->
        ${this.renderAtomSection("2", "Form", "form", 3, dp.unlockedForms)}

        <!-- Step 3: Vector -->
        ${this.renderAtomSection("3", "Vector", "vector", 3, dp.unlockedVectors)}

        <!-- Step 4: Modifiers -->
        ${this.renderAtomSection("4", "Modifiers (optional, up to 3)", "modifier", 5, dp.unlockedModifiers)}

        <!-- Step 5: Name -->
        <div style="margin-top: 20px;">
          <label style="font-size: 12px; color: #8888a0; display: block; margin-bottom: 6px;">Step 5: Name your skill</label>
          <input id="craft-name" type="text" placeholder="e.g. Frost Lance, Void Storm..." value="${this.getCraftName()}" style="
            width: 100%; box-sizing: border-box; padding: 10px 14px;
            background: rgba(10,10,20,0.8); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px; color: #e8e8f0; font-size: 14px;
          " />
        </div>

        <!-- Preview -->
        <div id="craft-preview" style="
          margin-top: 16px;
          background: rgba(10,10,20,0.5);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 16px;
          min-height: 60px;
          font-size: 13px;
          color: #8888a0;
        ">${this.getCraftPreviewHtml()}</div>

        <!-- Forge Button -->
        <button id="craft-create" ${this.canCraft() ? "" : "disabled"} style="
          width: 100%;
          margin-top: 16px;
          padding: 14px;
          background: ${this.canCraft() ? "linear-gradient(135deg, #9040ff 0%, #d0a0ff 100%)" : "rgba(40,40,55,0.5)"};
          color: ${this.canCraft() ? "#0a0a0f" : "#666670"};
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: bold;
          cursor: ${this.canCraft() ? "pointer" : "not-allowed"};
          letter-spacing: 0.05em;
        ">⚒ Forge Skill</button>
      </div>
    `;

    this.attachCraftListeners();
  }

  private renderAtomSection(
    step: string,
    label: string,
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

      // Check if this atom is selected
      let isSelected = false;
      if (type === "element") isSelected = this.craftElement === i;
      else if (type === "form") isSelected = this.craftForm === i;
      else if (type === "vector") isSelected = this.craftVector === i;
      else isSelected = this.craftModifiers.includes(i as ModifierId);

      if (isUnlocked) {
        buttons += `
          <button class="atom-btn" data-type="${type}" data-id="${i}" style="
            padding: 8px 14px; font-size: 13px;
            background: ${isSelected ? "rgba(255,184,108,0.25)" : "rgba(20,20,35,0.8)"};
            color: ${isSelected ? "#ffb86c" : (type === "element" ? color : "#e8e8f0")};
            border: 1px solid ${isSelected ? "#ffb86c" : (type === "element" ? color + "60" : "rgba(255,255,255,0.15)")};
            border-radius: 6px; cursor: pointer;
            transition: all 0.15s;
          ">${name}${isSelected ? " ✓" : ""}</button>
        `;
      } else {
        buttons += `
          <span style="
            padding: 8px 14px; font-size: 13px;
            background: rgba(10,10,15,0.5); color: #444450;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 6px;
          ">??? </span>
        `;
      }
    }

    return `
      <div style="margin-bottom: 16px;">
        <label style="font-size: 12px; color: #8888a0; display: block; margin-bottom: 8px;">Step ${step}: ${label}</label>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">${buttons}</div>
      </div>
    `;
  }

  private renderBackButton(): string {
    return `
      <button id="sanctum-back" style="
        background: none; border: none; color: #8888a0;
        font-size: 13px; cursor: pointer; padding: 0 0 16px 0;
        display: flex; align-items: center; gap: 6px;
      ">← Back to Sanctum</button>
    `;
  }

  private getCraftName(): string {
    const input = document.getElementById("craft-name") as HTMLInputElement;
    return input?.value || "";
  }

  private canCraft(): boolean {
    return this.craftElement !== null && this.craftForm !== null && this.craftVector !== null;
  }

  private getCraftPreviewHtml(): string {
    if (this.craftElement === null || this.craftForm === null || this.craftVector === null) {
      return "Select Element, Form, and Vector to see a preview...";
    }
    const nameInput = document.getElementById("craft-name") as HTMLInputElement;
    const name = nameInput?.value?.trim() || "Unnamed";
    const tempSkill: SkillDefinition = {
      id: "preview",
      name,
      element: this.craftElement,
      form: this.craftForm,
      vector: this.craftVector,
      modifiers: this.craftModifiers,
    };
    const stats = computeSkillStats(tempSkill);
    const desc = describeSkill(tempSkill);

    return `
      <div style="color: #ffb86c; font-weight: bold; font-size: 15px; margin-bottom: 4px;">${name}</div>
      <div style="color: #8888a0; margin-bottom: 8px;">${desc}</div>
      <div style="color: #e0e0e8; font-size: 12px;">
        <span style="color:#ff6020;">DMG: ${stats.damage.toFixed(1)}</span> &nbsp;
        <span style="color:#60c0ff;">CD: ${stats.cooldown.toFixed(2)}s</span> &nbsp;
        <span style="color:#40ff80;">Speed: ${stats.speed}</span> &nbsp;
        <span style="color:#d0a0ff;">Radius: ${stats.radius}</span>
      </div>
      ${stats.pierceCount > 0 ? '<div style="color:#60c0ff;font-size:11px;margin-top:4px;">Pierce: ' + stats.pierceCount + '</div>' : ""}
      ${stats.splitOnKill ? '<div style="color:#ff6020;font-size:11px;">Split on kill</div>' : ""}
      ${stats.lingerDuration > 0 ? '<div style="color:#60c0ff;font-size:11px;">Linger: ' + stats.lingerDuration + 's</div>' : ""}
      ${stats.chainCount > 0 ? '<div style="color:#ffe040;font-size:11px;">Chain: ' + stats.chainCount + '</div>' : ""}
      ${stats.growWithDistance ? '<div style="color:#9040ff;font-size:11px;">Grows with distance</div>' : ""}
    `;
  }

  private attachCraftListeners() {
    // Back button
    const backBtn = document.getElementById("sanctum-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        this.currentPanel = "main";
        this.render();
      });
    }

    // Atom buttons
    const atomButtons = this.container.querySelectorAll(".atom-btn");
    atomButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        let el = e.target as HTMLElement;
        while (el && !el.dataset.type) el = el.parentElement as HTMLElement;
        if (!el) return;
        const type = el.dataset.type as "element" | "form" | "vector" | "modifier";
        const id = parseInt(el.dataset.id!, 10) as ElementId | FormId | VectorId | ModifierId;
        this.handleAtomSelect(type, id);
      });
    });

    // Name input
    const nameInput = document.getElementById("craft-name") as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener("input", () => {
        this.updatePreviewOnly();
      });
    }

    // Forge button
    const createBtn = document.getElementById("craft-create");
    if (createBtn) {
      createBtn.addEventListener("click", () => this.handleCraftCreate());
    }
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
      const existingIdx = this.craftModifiers.indexOf(id as ModifierId);
      if (existingIdx >= 0) {
        this.craftModifiers[existingIdx] = null;
      } else {
        const emptyIdx = this.craftModifiers.indexOf(null);
        if (emptyIdx >= 0) {
          this.craftModifiers[emptyIdx] = id as ModifierId;
        }
      }
    }
    // Re-render the craft panel to update button states
    this.render();
    // Preserve the name input value
    const nameInput = document.getElementById("craft-name") as HTMLInputElement;
    if (nameInput) {
      // nameInput.value is already set from the render
    }
  }

  private updatePreviewOnly() {
    const preview = document.getElementById("craft-preview");
    if (preview) {
      preview.innerHTML = this.getCraftPreviewHtml();
    }
    const createBtn = document.getElementById("craft-create") as HTMLButtonElement;
    if (createBtn) {
      const canCraft = this.canCraft();
      createBtn.disabled = !canCraft;
    }
  }

  private handleCraftCreate() {
    if (this.craftElement === null || this.craftForm === null || this.craftVector === null) return;
    const nameInput = document.getElementById("craft-name") as HTMLInputElement;
    const name = nameInput?.value?.trim();
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
    console.log(`%c[Sanctum] %cCrafted: ${skill.name}`, "color: #ffb86c; font-weight: bold;", "color: #e0e0e8;");

    // Reset crafting state
    this.craftElement = null;
    this.craftForm = null;
    this.craftVector = null;
    this.craftModifiers = [null, null, null];

    // Go back to main
    this.currentPanel = "main";
    this.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Synthesize Panel
  // ─────────────────────────────────────────────────────────────────────────────

  private renderSynthesize() {
    const skills = this.runState.ownedSkills;
    const skillOptions = skills.map((s, i) => `<option value="${i}">${s.name}</option>`).join("");

    let previewHtml = "Select two different skills to see the synthesis result...";
    if (this.synthSkillA >= 0 && this.synthSkillB >= 0 && this.synthSkillA !== this.synthSkillB) {
      const skillA = skills[this.synthSkillA];
      const skillB = skills[this.synthSkillB];
      const synthesized = synthesizeSkills(skillA, skillB, "Synthesized");
      const stats = computeSkillStats(synthesized);
      const desc = describeSkill(synthesized);
      previewHtml = `
        <div style="color: #d0a0ff; font-weight: bold; font-size: 15px; margin-bottom: 4px;">Preview</div>
        <div style="color: #8888a0; margin-bottom: 8px;">${desc}</div>
        <div style="color: #e0e0e8; font-size: 12px;">
          DMG: ${stats.damage.toFixed(1)} • CD: ${stats.cooldown.toFixed(2)}s
        </div>
      `;
    }

    this.container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
        ${this.renderBackButton()}

        <h2 style="font-size: 22px; color: #d0a0ff; margin: 0 0 8px 0;">⚡ Synthesize Skills</h2>
        <p style="color: #8888a0; font-size: 13px; margin: 0 0 24px 0;">
          Combine two skills: takes Element + Vector from Skill A,
          Form from Skill B, and merges their modifiers.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div>
            <label style="font-size: 12px; color: #8888a0; display: block; margin-bottom: 6px;">Skill A (Element + Vector)</label>
            <select id="synth-a" style="width: 100%; padding: 10px; background: rgba(10,10,20,0.8); color: #e8e8f0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 13px;">
              <option value="-1">— select —</option>
              ${skillOptions}
            </select>
          </div>
          <div>
            <label style="font-size: 12px; color: #8888a0; display: block; margin-bottom: 6px;">Skill B (Form)</label>
            <select id="synth-b" style="width: 100%; padding: 10px; background: rgba(10,10,20,0.8); color: #e8e8f0; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-size: 13px;">
              <option value="-1">— select —</option>
              ${skillOptions}
            </select>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="font-size: 12px; color: #8888a0; display: block; margin-bottom: 6px;">New Skill Name</label>
          <input id="synth-name" type="text" placeholder="Name your synthesized skill..." style="
            width: 100%; box-sizing: border-box; padding: 10px 14px;
            background: rgba(10,10,20,0.8); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px; color: #e8e8f0; font-size: 14px;
          " />
        </div>

        <div id="synth-preview" style="
          background: rgba(10,10,20,0.5);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          font-size: 13px;
          color: #8888a0;
          min-height: 60px;
        ">${previewHtml}</div>

        <button id="synth-create" disabled style="
          width: 100%; padding: 14px;
          background: rgba(144,64,255,0.3); color: #d0a0ff;
          border: 1px solid rgba(144,64,255,0.5); border-radius: 8px;
          font-size: 15px; font-weight: bold; cursor: pointer;
        ">⚡ Synthesize</button>
      </div>
    `;

    this.attachSynthListeners();
  }

  private attachSynthListeners() {
    const backBtn = document.getElementById("sanctum-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        this.currentPanel = "main";
        this.render();
      });
    }

    const synthA = document.getElementById("synth-a") as HTMLSelectElement;
    const synthB = document.getElementById("synth-b") as HTMLSelectElement;
    const synthName = document.getElementById("synth-name") as HTMLInputElement;
    if (synthA) synthA.addEventListener("change", () => this.updateSynthPreview());
    if (synthB) synthB.addEventListener("change", () => this.updateSynthPreview());
    if (synthName) synthName.addEventListener("input", () => this.updateSynthPreview());

    const synthCreateBtn = document.getElementById("synth-create");
    if (synthCreateBtn) {
      synthCreateBtn.addEventListener("click", () => this.handleSynthCreate());
    }
  }

  private updateSynthPreview() {
    const synthA = document.getElementById("synth-a") as HTMLSelectElement;
    const synthB = document.getElementById("synth-b") as HTMLSelectElement;
    const synthName = document.getElementById("synth-name") as HTMLInputElement;

    this.synthSkillA = parseInt(synthA?.value || "-1", 10);
    this.synthSkillB = parseInt(synthB?.value || "-1", 10);

    const preview = document.getElementById("synth-preview");
    const createBtn = document.getElementById("synth-create") as HTMLButtonElement;

    if (this.synthSkillA < 0 || this.synthSkillB < 0 || this.synthSkillA === this.synthSkillB) {
      if (preview) preview.innerHTML = "Select two different skills to see the synthesis result...";
      if (createBtn) createBtn.disabled = true;
      return;
    }

    const skillA = this.runState.ownedSkills[this.synthSkillA];
    const skillB = this.runState.ownedSkills[this.synthSkillB];
    const name = synthName?.value?.trim() || "Synthesized";
    const synthesized = synthesizeSkills(skillA, skillB, name);
    const stats = computeSkillStats(synthesized);
    const desc = describeSkill(synthesized);

    if (preview) {
      preview.innerHTML = `
        <div style="color: #d0a0ff; font-weight: bold; font-size: 15px; margin-bottom: 4px;">${name}</div>
        <div style="color: #8888a0; margin-bottom: 8px;">${desc}</div>
        <div style="color: #e0e0e8; font-size: 12px;">
          DMG: ${stats.damage.toFixed(1)} • CD: ${stats.cooldown.toFixed(2)}s
        </div>
      `;
    }

    if (createBtn) {
      createBtn.disabled = !synthName?.value?.trim();
    }
  }

  private handleSynthCreate() {
    if (this.synthSkillA < 0 || this.synthSkillB < 0) return;
    const synthName = document.getElementById("synth-name") as HTMLInputElement;
    const name = synthName?.value?.trim();
    if (!name) return;

    const skillA = this.runState.ownedSkills[this.synthSkillA];
    const skillB = this.runState.ownedSkills[this.synthSkillB];
    const synthesized = synthesizeSkills(skillA, skillB, name);

    addCraftedSkill(this.runState, synthesized);
    console.log(`%c[Sanctum] %cSynthesized: ${synthesized.name}`, "color: #ffb86c; font-weight: bold;", "color: #e0e0e8;");

    this.synthSkillA = -1;
    this.synthSkillB = -1;
    this.currentPanel = "main";
    this.render();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Grimoire Panel
  // ─────────────────────────────────────────────────────────────────────────────

  private renderGrimoire() {
    const skills = this.runState.ownedSkills;
    const skillList = skills.map((s, i) => {
      const desc = describeSkill(s);
      const stats = computeSkillStats(s);
      const isEquipped = this.runState.equippedSkillIndices.includes(i);
      return `
        <div style="
          background: rgba(10,10,20,0.5);
          border: 1px solid ${isEquipped ? "rgba(255,184,108,0.4)" : "rgba(255,255,255,0.05)"};
          border-radius: 8px; padding: 14px; margin-bottom: 8px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="color: #e8e8f0; font-weight: 600; font-size: 14px;">
              ${s.name} ${isEquipped ? '<span style="color:#40ff80;font-size:11px;">✓ equipped</span>' : ""}
            </span>
            <span style="color: #8888a0; font-size: 11px;">
              ${stats.damage.toFixed(0)} dmg • ${stats.cooldown.toFixed(2)}s
            </span>
          </div>
          <div style="color: #8888a0; font-size: 11px;">${desc}</div>
        </div>
      `;
    }).join("");

    this.container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
        ${this.renderBackButton()}

        <h2 style="font-size: 22px; color: #60c0ff; margin: 0 0 8px 0;">📖 Grimoire (${skills.length})</h2>
        <p style="color: #8888a0; font-size: 13px; margin: 0 0 24px 0;">
          All skills you own. Go to Equip to assign them to slots.
        </p>

        <div style="max-height: 60vh; overflow-y: auto;">
          ${skillList || '<p style="color:#8888a0;font-size:13px;">No skills yet.</p>'}
        </div>
      </div>
    `;

    const backBtn = document.getElementById("sanctum-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        this.currentPanel = "main";
        this.render();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Equip Panel
  // ─────────────────────────────────────────────────────────────────────────────

  private renderEquip() {
    const slots = [0, 1, 2, 3];
    const slotHtml = slots.map((slot) => {
      const idx = this.runState.equippedSkillIndices[slot];
      const skill = idx >= 0 ? this.runState.ownedSkills[idx] : null;
      void skill;
      return `
        <div style="
          background: rgba(10,10,20,0.5);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 14px;
        ">
          <div style="font-size: 11px; color: #ffb86c; margin-bottom: 6px; font-weight: 600;">
            SLOT ${slot + 1} <span style="color:#666670;font-weight:normal;">(press ${slot + 1} in game)</span>
          </div>
          <select class="equip-select" data-slot="${slot}" style="
            width: 100%; padding: 8px;
            background: rgba(10,10,20,0.8); color: #e8e8f0;
            border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 13px;
          ">
            <option value="-1">— empty —</option>
            ${this.runState.ownedSkills.map((s, i) =>
              `<option value="${i}" ${idx === i ? "selected" : ""}>${s.name}</option>`
            ).join("")}
          </select>
        </div>
      `;
    }).join("");

    this.container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
        ${this.renderBackButton()}

        <h2 style="font-size: 22px; color: #40ff80; margin: 0 0 8px 0;">⚔ Equip Skills</h2>
        <p style="color: #8888a0; font-size: 13px; margin: 0 0 24px 0;">
          Assign up to 4 skills. In-game, press 1-4 to cast them toward your mouse.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${slotHtml}
        </div>
      </div>
    `;

    const backBtn = document.getElementById("sanctum-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        this.currentPanel = "main";
        this.render();
      });
    }

    const equipSelects = this.container.querySelectorAll(".equip-select");
    equipSelects.forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const target = e.target as HTMLSelectElement;
        const slot = parseInt(target.dataset.slot!, 10);
        const skillIdx = parseInt(target.value, 10);
        equipSkill(this.runState, slot, skillIdx);
      });
    });
  }
}
